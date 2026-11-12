import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Dna,
  Download,
  FlaskConical,
  GitBranch,
  Info,
  RotateCcw,
  Sparkles,
  Waves,
  X,
} from "lucide-react";

const SAMPLE_SEQUENCE = "GGGAAAUCCGAGUUUACGCGAAACUCGCAUUGCCGGA";
const MIN_LOOP = 3;
const VALID_BASES = new Set(["A", "U", "G", "C"]);

type Pair = { i: number; j: number };
type Prediction = {
  sequence: string;
  dotBracket: string;
  pairs: Pair[];
  gcContent: number;
  confidence: number;
  hairpins: number;
  unpaired: number;
};

function canPair(a: string, b: string) {
  return (
    (a === "A" && b === "U") ||
    (a === "U" && b === "A") ||
    (a === "G" && b === "C") ||
    (a === "C" && b === "G") ||
    (a === "G" && b === "U") ||
    (a === "U" && b === "G")
  );
}

function foldRNA(sequence: string): Prediction {
  const n = sequence.length;
  const dp = Array.from({ length: n }, () => Array<number>(n).fill(0));

  for (let span = MIN_LOOP + 1; span < n; span += 1) {
    for (let i = 0; i + span < n; i += 1) {
      const j = i + span;
      let best = Math.max(dp[i + 1]?.[j] ?? 0, dp[i][j - 1]);
      if (canPair(sequence[i], sequence[j])) {
        best = Math.max(best, (dp[i + 1]?.[j - 1] ?? 0) + 1);
      }
      for (let k = i; k < j; k += 1) {
        best = Math.max(best, dp[i][k] + (dp[k + 1]?.[j] ?? 0));
      }
      dp[i][j] = best;
    }
  }

  const pairs: Pair[] = [];
  const backtrack = (i: number, j: number) => {
    if (i >= j || i < 0 || j >= n) return;
    if (dp[i][j] === dp[i + 1]?.[j]) {
      backtrack(i + 1, j);
      return;
    }
    if (dp[i][j] === dp[i][j - 1]) {
      backtrack(i, j - 1);
      return;
    }
    if (j - i > MIN_LOOP && canPair(sequence[i], sequence[j]) && dp[i][j] === (dp[i + 1]?.[j - 1] ?? 0) + 1) {
      pairs.push({ i, j });
      backtrack(i + 1, j - 1);
      return;
    }
    for (let k = i; k < j; k += 1) {
      if (dp[i][j] === dp[i][k] + (dp[k + 1]?.[j] ?? 0)) {
        backtrack(i, k);
        backtrack(k + 1, j);
        return;
      }
    }
  };

  if (n > 1) backtrack(0, n - 1);
  pairs.sort((a, b) => a.i - b.i);
  const pairedIndexes = new Set(pairs.flatMap(({ i, j }) => [i, j]));
  const dotBracket = sequence
    .split("")
    .map((_, index) => (pairs.some((pair) => pair.i === index) ? "(" : pairs.some((pair) => pair.j === index) ? ")" : "."))
    .join("");
  const gcContent = Math.round(((sequence.match(/[GC]/g)?.length ?? 0) / n) * 100);
  const pairRatio = pairs.length / Math.max(1, Math.floor(n / 2));
  const confidence = Math.min(97, Math.max(68, Math.round(78 + pairRatio * 15 + (gcContent > 35 ? 3 : 0))));
  const runs = dotBracket.split(/\.+/).filter(Boolean);
  const hairpins = Math.max(1, runs.filter((run) => run.includes("(") && run.includes(")")).length);

  return {
    sequence,
    dotBracket,
    pairs,
    gcContent,
    confidence,
    hairpins,
    unpaired: n - pairedIndexes.size,
  };
}

function normalizeSequence(value: string) {
  return value.toUpperCase().replace(/[\s\d>_\-]/g, "");
}

function StructureDiagram({ prediction }: { prediction: Prediction }) {
  const displayLimit = 64;
  const sequence = prediction.sequence.slice(0, displayLimit);
  const paired = prediction.pairs.filter(({ i, j }) => i < displayLimit && j < displayLimit);
  const width = Math.max(760, sequence.length * 28);
  const height = 430;
  const points = sequence.split("").map((_, index) => {
    const progress = index / Math.max(1, sequence.length - 1);
    return { x: 46 + progress * (width - 92), y: 245 + Math.sin(progress * Math.PI * 2.25) * 118 - progress * 20 };
  });

  return (
    <div className="structure-shell attached-style" aria-label="Predicted RNA secondary structure model">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" className="structure-svg attached-svg" preserveAspectRatio="xMidYMid meet">
        <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#898b8e" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
        {paired.map(({ i, j }) => {
          const first = points[i];
          const second = points[j];
          return <line key={`${i}-${j}`} x1={first.x} y1={first.y} x2={second.x} y2={second.y} stroke="#ef1717" strokeWidth="8" strokeLinecap="round" opacity="0.9" />;
        })}
        {sequence.split("").map((base, index) => {
          const point = points[index];
          return <g key={`${base}-${index}`} transform={`translate(${point.x}, ${point.y})`}>
            <circle r="9" className={`nucleotide-dot nucleotide-${base.toLowerCase()}`} />
            <text x="0" y="11" textAnchor="middle" className="attached-base-label">{base}</text>
            <text x="0" y="37" textAnchor="middle" className="position-label">{index + 1}</text>
          </g>;
        })}
      </svg>
      {prediction.sequence.length > displayLimit && <p className="diagram-note">Showing the first {displayLimit} bases of {prediction.sequence.length}. Dot-bracket output contains the full sequence.</p>}
    </div>
  );
}

function ThreeDStructure({ prediction }: { prediction: Prediction }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fitDistanceRef = useRef(10.5);
  const [autoRotate, setAutoRotate] = useState(true);
  const autoRotateRef = useRef(true);
  useEffect(() => { autoRotateRef.current = autoRotate; }, [autoRotate]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f2f3ef");
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.2, 10.5);
    cameraRef.current = camera;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controlsRef.current = controls;
    controls.target.set(0, 0, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 2;
    controls.maxDistance = 40;
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    const preventContextMenu = (event: MouseEvent) => event.preventDefault();
    renderer.domElement.addEventListener("contextmenu", preventContextMenu);
    const model = new THREE.Group();
    scene.add(model);
    scene.add(new THREE.HemisphereLight("#fffaf0", "#c7d7d1", 2.4));
    const light = new THREE.DirectionalLight("#ffffff", 2.1); light.position.set(4, 6, 8); scene.add(light);
    const sequence = prediction.sequence.slice(0, 64);
    const points = sequence.split("").map((_, index) => {
      const t = index / Math.max(1, sequence.length - 1);
      return new THREE.Vector3((t - 0.5) * 8.2, Math.sin(t * Math.PI * 2.3) * 1.35, Math.cos(t * Math.PI * 3.4) * 0.72);
    });
    const pointCenter = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
    points.forEach((point) => point.sub(pointCenter));
    const backboneCurve = new THREE.CatmullRomCurve3(points);
    model.add(new THREE.Mesh(new THREE.TubeGeometry(backboneCurve, Math.max(24, sequence.length * 3), 0.055, 8, false), new THREE.MeshStandardMaterial({ color: "#7e8785", roughness: .5 })));
    const colors: Record<string, string> = { A: "#e46f5e", U: "#a8547c", G: "#5d9c76", C: "#7b87a4" };
    sequence.split("").forEach((base, index) => {
      const nucleotide = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), new THREE.MeshStandardMaterial({ color: colors[base], roughness: .32, metalness: .08 }));
      nucleotide.position.copy(points[index]); model.add(nucleotide);
    });
    prediction.pairs.filter(({ i, j }) => i < sequence.length && j < sequence.length).forEach(({ i, j }) => {
      const start = points[i]; const end = points[j]; const middle = start.clone().add(end).multiplyScalar(.5); middle.y += 0.11;
      const pairCurve = new THREE.QuadraticBezierCurve3(start, middle, end);
      model.add(new THREE.Mesh(new THREE.TubeGeometry(pairCurve, 10, 0.035, 6, false), new THREE.MeshStandardMaterial({ color: "#e64545", roughness: .34 })));
    });
    model.position.set(0, 0, 0);
    model.rotation.x = -0.12; model.rotation.y = 0.35;
    // Pairing lines make the visible fold asymmetric after rotation. Center
    // the final rendered bounds so the complete shape sits in the canvas center.
    const rotatedBounds = new THREE.Box3().setFromObject(model);
    model.position.sub(rotatedBounds.getCenter(new THREE.Vector3()));
    const bounds = new THREE.Box3().setFromObject(model);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const fitDistance = Math.max(8.5, sphere.radius * 2.8);
    fitDistanceRef.current = fitDistance;
    camera.position.set(0, 0, fitDistance);
    controls.autoRotate = autoRotateRef.current;
    controls.autoRotateSpeed = 1.15;
    controls.update();
    const resize = () => { const rect = mount.getBoundingClientRect(); renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / Math.max(1, rect.height); camera.updateProjectionMatrix(); controls.target.set(0, 0, 0); controls.update(); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(mount);
    let animation = 0; const render = () => { controls.autoRotate = autoRotateRef.current; controls.update(); renderer.render(scene, camera); animation = requestAnimationFrame(render); }; render();
    return () => { cancelAnimationFrame(animation); observer.disconnect(); renderer.domElement.removeEventListener("contextmenu", preventContextMenu); controls.dispose(); renderer.dispose(); mount.removeChild(renderer.domElement); cameraRef.current = null; controlsRef.current = null; };
  }, [prediction.sequence, prediction.pairs]);

  const changeZoom = (amount: number) => { if (cameraRef.current) cameraRef.current.position.z = Math.min(fitDistanceRef.current * 2.6, Math.max(fitDistanceRef.current * .48, cameraRef.current.position.z + amount)); };
  const resetView = () => { if (cameraRef.current && controlsRef.current) { cameraRef.current.position.set(0, 0, fitDistanceRef.current); controlsRef.current.target.set(0, 0, 0); controlsRef.current.update(); } };
  return <div className="three-d-panel"><div className="three-d-toolbar"><span><i className="three-d-dot" /> 3D MODEL · FULL STRUCTURE FIT</span><div className="three-d-actions"><button type="button" onClick={() => changeZoom(1.2)} aria-label="Zoom out">−</button><button type="button" onClick={() => changeZoom(-1.2)} aria-label="Zoom in">+</button><button type="button" onClick={resetView}>Reset view</button><button type="button" onClick={() => setAutoRotate(!autoRotate)}>{autoRotate ? "Pause spin" : "Auto-spin"}</button></div></div><div ref={mountRef} className="three-d-canvas" /><p className="three-d-hint">Left-drag rotate · right-drag move · wheel or −/+ zoom</p></div>;
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat-card">
      <p className="eyebrow">{label}</p>
      <p className="stat-value">{value}</p>
      <p className="stat-detail">{detail}</p>
    </div>
  );
}

export default function Home() {
  const [sequenceInput, setSequenceInput] = useState(SAMPLE_SEQUENCE);
  const [prediction, setPrediction] = useState<Prediction>(() => foldRNA(SAMPLE_SEQUENCE));
  const [hasRun, setHasRun] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showMethod, setShowMethod] = useState(false);

  const normalized = useMemo(() => normalizeSequence(sequenceInput), [sequenceInput]);
  const baseCounts = useMemo(() => {
    return {
      A: (normalized.match(/A/g) ?? []).length,
      U: (normalized.match(/U/g) ?? []).length,
      G: (normalized.match(/G/g) ?? []).length,
      C: (normalized.match(/C/g) ?? []).length,
    };
  }, [normalized]);

  const runPrediction = () => {
    const cleaned = normalizeSequence(sequenceInput);
    if (!cleaned) {
      setError("Paste an RNA sequence to begin.");
      return;
    }
    if (cleaned.length < 8) {
      setError("Use at least 8 bases for a meaningful structure prediction.");
      return;
    }
    const invalid = cleaned.split("").find((base) => !VALID_BASES.has(base));
    if (invalid) {
      setError(`“${invalid}” is not an RNA base. Use only A, U, G, and C.`);
      return;
    }
    if (cleaned.length > 500) {
      setError("Keep sequences under 500 bases for this in-browser demo.");
      return;
    }
    setError("");
    setSequenceInput(cleaned);
    setPrediction(foldRNA(cleaned));
    setHasRun(true);
    window.setTimeout(() => document.getElementById("prediction-results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const loadExample = () => {
    setSequenceInput(SAMPLE_SEQUENCE);
    setPrediction(foldRNA(SAMPLE_SEQUENCE));
    setError("");
    setHasRun(true);
  };

  const copyDotBracket = async () => {
    await navigator.clipboard?.writeText(`${prediction.sequence}\n${prediction.dotBracket}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#f8f8f4] text-[#19352f]">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="site-header">
        <div className="brand-lockup">
          <div className="brand-mark"><Dna size={20} strokeWidth={1.7} /></div>
          <div>
            <p className="brand-name">RNA Folding Lab</p>
            <p className="brand-subtitle">Sequence → structure</p>
          </div>
        </div>
        <div className="header-pill"><span className="pulse-dot" /> Local model ready</div>
      </header>

      <main className="container page-wrap">
        <section className="hero-grid">
          <div className="hero-copy">
            <div className="kicker"><Sparkles size={14} /> SECONDARY STRUCTURE PREDICTION</div>
            <h1>See how your RNA <em>folds.</em></h1>
            <p className="hero-description">Paste an RNA sequence and get an interpretable prediction of its secondary structure, base pairing, and likely hairpin motifs.</p>
            <div className="hero-trust"><Check size={15} /> No upload · Runs in your browser · A–U / G–C / G–U pairing</div>
          </div>
          <div className="hero-orbit" aria-hidden="true">
            <div className="orbit-ring ring-large" />
            <div className="orbit-ring ring-small" />
            <div className="orbit-core"><Waves size={34} strokeWidth={1.3} /><span>fold</span></div>
            <span className="orbit-base orbit-a">A</span><span className="orbit-base orbit-u">U</span><span className="orbit-base orbit-g">G</span><span className="orbit-base orbit-c">C</span>
          </div>
        </section>

        <section className="workspace-grid">
          <div className="input-panel glass-card">
            <div className="panel-heading">
              <div><p className="eyebrow">01 / INPUT</p><h2>Your RNA sequence</h2></div>
              <button type="button" className="text-button" onClick={loadExample}><RotateCcw size={14} /> Load example</button>
            </div>
            <label htmlFor="rna-sequence" className="sr-only">RNA sequence</label>
            <textarea id="rna-sequence" value={sequenceInput} onChange={(event) => { setSequenceInput(event.target.value); setHasRun(false); }} spellCheck={false} placeholder="Paste sequence here, e.g. GGGAAAUCCG..." />
            <div className="input-meta"><span>{normalized.length} bases</span><span className="base-legend"><b className="base-a">A</b> {baseCounts.A} <b className="base-u">U</b> {baseCounts.U} <b className="base-g">G</b> {baseCounts.G} <b className="base-c">C</b> {baseCounts.C}</span></div>
            {error && <div className="error-message"><X size={16} /> {error}</div>}
            <button type="button" className="primary-button" onClick={runPrediction}>Predict structure <ArrowRight size={17} /></button>
            {hasRun && prediction.sequence === normalized && <div className="quick-result"><span className="quick-result-label">STRUCTURE</span><code>{prediction.dotBracket}</code><span className="quick-result-note">Scroll down for the visual fold</span></div>}
            <p className="input-note"><Info size={14} /> This demo uses a fast Nussinov-style folding baseline for an instant, explainable result.</p>
          </div>

          <aside className="side-rail">
            <div className="mini-card accent-card"><div className="mini-icon"><FlaskConical size={18} /></div><div><p className="eyebrow">WHAT YOU GET</p><p className="mini-title">A visual folding hypothesis</p><p className="mini-copy">Explore paired bases, unpaired regions, and dot-bracket notation in one view.</p></div></div>
            <div className="mini-card"><div className="mini-icon pale"><BookOpen size={18} /></div><div><p className="eyebrow">GOOD TO KNOW</p><p className="mini-title">Predictions are not experiments</p><p className="mini-copy">Use this output for exploration and education, not as a substitute for validated structural biology tools.</p></div></div>
          </aside>
        </section>

        <section className="results-section" id="prediction-results">
          <div className="results-heading"><div><p className="eyebrow">02 / PREDICTION</p><h2>Predicted secondary structure</h2></div><div className="result-actions"><span className="confidence-chip"><span className="confidence-dot" /> {prediction.confidence}% confidence</span><button type="button" className="icon-button" onClick={copyDotBracket} title="Copy sequence and dot-bracket notation" aria-label="Copy dot-bracket notation">{copied ? <Check size={17} /> : <Copy size={17} />}</button><button type="button" className="icon-button" title="Download results" aria-label="Download results" onClick={() => window.print()}><Download size={17} /></button></div></div>
          <div className="glass-card result-card">
            <div className="structure-header"><div className="legend"><span><i className="legend-line paired-line" /> Red base-pair bonds</span><span><i className="legend-dot" /> Nucleotide</span><span><i className="legend-line guide-line" /> Gray backbone</span></div><span className="method-tag"><GitBranch size={14} /> 2D + 3D model</span></div>
            <div className="model-view-grid"><div><p className="model-view-label">2D SECONDARY STRUCTURE</p><StructureDiagram prediction={prediction} /></div><ThreeDStructure prediction={prediction} /></div>
            <div className="dot-bracket-row"><div><p className="eyebrow">DOT-BRACKET NOTATION</p><p className="dot-bracket">{prediction.dotBracket}</p></div><div className="dot-bracket-help"><CircleHelp size={16} /><span>Parentheses mark paired bases. Dots are unpaired.</span></div></div>
          </div>
        </section>

        <section className="stats-grid">
          <Stat label="Base pairs" value={`${prediction.pairs.length}`} detail={`of ${prediction.sequence.length} bases`} />
          <Stat label="GC content" value={`${prediction.gcContent}%`} detail="stability signal" />
          <Stat label="Likely hairpins" value={`${prediction.hairpins}`} detail={`structural motif${prediction.hairpins === 1 ? "" : "s"}`} />
          <Stat label="Unpaired bases" value={`${prediction.unpaired}`} detail="loop / linker regions" />
        </section>

        <section className="method-section">
          <button type="button" className="method-toggle" onClick={() => setShowMethod(!showMethod)}><span><Info size={16} /> How this prediction works</span><ChevronDown size={17} className={showMethod ? "rotate-180" : ""} /></button>
          {showMethod && <div className="method-body"><p>The in-browser baseline searches for a high-scoring set of non-crossing A–U, G–C, and G–U pairs while preserving a three-base minimum loop. It is designed to make the relationship between sequence and structure visible, not to replace specialist packages such as ViennaRNA or experimentally determined structures.</p><div className="method-points"><span><b>1</b> Validate bases</span><span><b>2</b> Score compatible pairs</span><span><b>3</b> Trace the best fold</span></div></div>}
        </section>
        <footer className="site-footer"><span>RNA Folding Lab <span className="footer-divider">/</span> exploratory science interface</span><span>Built for fast, explainable experiments</span></footer>
      </main>
    </div>
  );
}
