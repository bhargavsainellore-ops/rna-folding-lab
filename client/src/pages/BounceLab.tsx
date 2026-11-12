import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  CirclePause,
  CirclePlay,
  Gauge,
  Layers3,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Wind,
} from "lucide-react";
import { Link } from "wouter";

type Settings = {
  gravity: number;
  launchHeight: number;
  ballCount: number;
  restitution: number;
  airDrag: number;
};

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  glow: string;
};

const DEFAULTS: Settings = { gravity: 9.8, launchHeight: 78, ballCount: 5, restitution: 0.76, airDrag: 0.01 };
const COLORS = [
  ["#f38670", "rgba(243,134,112,.44)"],
  ["#6ec3c2", "rgba(110,195,194,.40)"],
  ["#f2ca68", "rgba(242,202,104,.40)"],
  ["#b29ae7", "rgba(178,154,231,.40)"],
  ["#ef9aaf", "rgba(239,154,175,.40)"],
  ["#8cc98e", "rgba(140,201,142,.40)"],
];

function makeBalls(settings: Settings, width: number, height: number): Ball[] {
  const floorY = height - 38;
  const usableHeight = Math.max(150, floorY - 18);
  return Array.from({ length: settings.ballCount }, (_, index) => {
    const [color, glow] = COLORS[index % COLORS.length];
    const radius = 16 + (index % 3) * 2;
    const x = width * (0.18 + ((index * 0.145) % 0.68));
    const launchFraction = settings.launchHeight / 100;
    const y = floorY - usableHeight * (0.62 + launchFraction * 0.3) - (index % 2) * 9;
    return { x, y, vx: (index % 2 ? -1 : 1) * (14 + index * 3), vy: -45 - index * 8, radius, color, glow };
  });
}

function formatValue(value: number, suffix = "") {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}${suffix}`;
}

export default function BounceLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef<Settings>(DEFAULTS);
  const ballsRef = useRef<Ball[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const elapsedRef = useRef(0);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [collisionCount, setCollisionCount] = useState(0);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let collisions = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ballsRef.current = makeBalls(settingsRef.current, width, height);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const draw = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const dt = Math.min(0.032, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;
      const current = settingsRef.current;
      const floorY = height - 38;
      const left = 20;
      const right = width - 20;
      const top = 20;
      const worldGravity = 185 * (current.gravity / 9.8);

      if (!paused) {
        elapsedRef.current += dt;
        ballsRef.current.forEach((ball) => {
          ball.vy += worldGravity * dt;
          ball.vx *= 1 - current.airDrag * dt * 12;
          ball.vy *= 1 - current.airDrag * dt * 3;
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;
          if (ball.x - ball.radius < left) { ball.x = left + ball.radius; ball.vx = Math.abs(ball.vx) * current.restitution; collisions += 1; }
          if (ball.x + ball.radius > right) { ball.x = right - ball.radius; ball.vx = -Math.abs(ball.vx) * current.restitution; collisions += 1; }
          if (ball.y - ball.radius < top) { ball.y = top + ball.radius; ball.vy = Math.abs(ball.vy) * current.restitution; collisions += 1; }
          if (ball.y + ball.radius > floorY) { ball.y = floorY - ball.radius; ball.vy = -Math.abs(ball.vy) * current.restitution; collisions += 1; }
        });
      }

      ctx.clearRect(0, 0, width, height);
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#182e3a"); bg.addColorStop(1, "#0f202c"); ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = "rgba(159,207,200,.07)"; ctx.lineWidth = 1;
      for (let x = 28; x < width; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
      for (let y = 22; y < height; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(167,219,204,.32)"; ctx.setLineDash([5, 7]); ctx.strokeRect(left, top, right - left, floorY - top); ctx.setLineDash([]);
      const floor = ctx.createLinearGradient(0, floorY, 0, height);
      floor.addColorStop(0, "#d6bb93"); floor.addColorStop(1, "#b08d68"); ctx.fillStyle = floor; ctx.fillRect(0, floorY, width, height - floorY);
      ctx.strokeStyle = "#f4dcac"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, floorY); ctx.lineTo(width, floorY); ctx.stroke();
      ctx.fillStyle = "rgba(211,244,230,.52)"; ctx.font = "10px DM Mono, monospace"; ctx.fillText(`${current.gravity.toFixed(1)} m/s²`, 29, 39);
      ctx.fillStyle = "rgba(211,244,230,.32)"; ctx.fillText("SIMULATION CHAMBER", right - 137, 39);

      ballsRef.current.forEach((ball) => {
        const shadowY = floorY - 4;
        const shadowSize = Math.max(5, 24 - Math.abs(shadowY - ball.y) * 0.045);
        ctx.fillStyle = "rgba(8,16,20,.28)"; ctx.beginPath(); ctx.ellipse(ball.x, shadowY, shadowSize, 4, 0, 0, Math.PI * 2); ctx.fill();
        const trail = ctx.createRadialGradient(ball.x, ball.y, 0, ball.x, ball.y, ball.radius * 2.5);
        trail.addColorStop(0, ball.glow); trail.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = trail; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius * 2.5, 0, Math.PI * 2); ctx.fill();
        const gradient = ctx.createRadialGradient(ball.x - ball.radius * .35, ball.y - ball.radius * .45, 1, ball.x, ball.y, ball.radius * 1.15);
        gradient.addColorStop(0, "#fff5df"); gradient.addColorStop(.18, ball.color); gradient.addColorStop(1, "#392d40"); ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.58)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.beginPath(); ctx.arc(ball.x - ball.radius * .33, ball.y - ball.radius * .38, 2.5, 0, Math.PI * 2); ctx.fill();
      });

      if (collisions > 0 && collisions % 9 === 0) setCollisionCount(collisions);
      if (Math.floor(elapsedRef.current * 5) !== Math.floor((elapsedRef.current - dt) * 5)) setElapsed(elapsedRef.current);
      frameRef.current = requestAnimationFrame(draw);
    };
    frameRef.current = requestAnimationFrame(draw);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); observer.disconnect(); };
  }, [paused]);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    setSettings(next);
    if (key === "ballCount") {
      const canvas = canvasRef.current;
      if (canvas) ballsRef.current = makeBalls(next, canvas.clientWidth, canvas.clientHeight);
    }
  };

  const reset = () => {
    const canvas = canvasRef.current;
    const next = { ...DEFAULTS };
    settingsRef.current = next;
    setSettings(next);
    setPaused(false);
    elapsedRef.current = 0;
    setElapsed(0);
    setCollisionCount(0);
    if (canvas) ballsRef.current = makeBalls(next, canvas.clientWidth, canvas.clientHeight);
  };

  return (
    <div className="bounce-page">
      <header className="bounce-header">
        <div className="bounce-brand"><div className="bounce-brand-mark"><Sparkles size={17} /></div><div><strong>BOUNCE LAB</strong><span>PHYSICS PLAYGROUND</span></div></div>
        <div className="bounce-header-right"><div className="live-indicator"><i /> LIVE SIMULATION</div><Link href="/" className="back-link"><ArrowLeft size={14} /> RNA Folding Lab</Link></div>
      </header>
      <main className="bounce-main">
        <div className="bounce-intro"><div><p className="bounce-kicker">EXPERIMENT 02 / MOTION</p><h1>Make gravity <em>visible.</em></h1><p>Drop a handful of balls into the chamber. Tune the forces. Watch the system find its rhythm.</p></div><div className="experiment-readout"><span className="readout-label">SIM TIME</span><strong>{elapsed.toFixed(1)}<small>s</small></strong><span>{collisionCount} collisions</span></div></div>
        <section className="bounce-layout">
          <aside className="control-panel">
            <div className="control-heading"><div><p className="bounce-kicker">CONTROL DECK</p><h2>Parameters</h2></div><SlidersHorizontal size={19} /></div>
            <div className="control-group"><div className="control-label"><span>Gravity</span><b>{formatValue(settings.gravity, " m/s²")}</b></div><input type="range" min="1" max="20" step="0.1" value={settings.gravity} onChange={(event) => updateSetting("gravity", Number(event.target.value))} /><div className="range-hints"><span>Moon</span><span>Earth</span><span>Jupiter</span></div></div>
            <div className="control-group"><div className="control-label"><span>Launch height</span><b>{formatValue(settings.launchHeight, "%")}</b></div><input type="range" min="25" max="95" step="1" value={settings.launchHeight} onChange={(event) => updateSetting("launchHeight", Number(event.target.value))} /><div className="range-hints"><span>Low</span><span>High</span></div></div>
            <div className="control-group"><div className="control-label"><span>Number of balls</span><b>{settings.ballCount}</b></div><input type="range" min="1" max="12" step="1" value={settings.ballCount} onChange={(event) => updateSetting("ballCount", Number(event.target.value))} /><div className="range-hints"><span>Solo</span><span>Swarm</span></div></div>
            <div className="control-group"><div className="control-label"><span>Restitution</span><b>{settings.restitution.toFixed(2)}</b></div><input type="range" min="0.35" max="1" step="0.01" value={settings.restitution} onChange={(event) => updateSetting("restitution", Number(event.target.value))} /><div className="range-hints"><span>Soft</span><span>Perfect</span></div></div>
            <div className="control-group"><div className="control-label"><span>Air drag</span><b>{settings.airDrag.toFixed(2)}</b></div><input type="range" min="0" max="0.04" step="0.005" value={settings.airDrag} onChange={(event) => updateSetting("airDrag", Number(event.target.value))} /><div className="range-hints"><span>Vacuum</span><span>Thick air</span></div></div>
            <div className="control-actions"><button type="button" className="bounce-action primary" onClick={() => setPaused(!paused)}>{paused ? <CirclePlay size={17} /> : <CirclePause size={17} />}{paused ? "Resume" : "Pause"}</button><button type="button" className="bounce-action secondary" onClick={reset}><RotateCcw size={16} /> Reset</button></div>
            <div className="tip-card"><Gauge size={17} /><span><strong>Try this</strong> Set restitution to 1.00 and gravity to 1 m/s² for an almost weightless bounce.</span></div>
          </aside>
          <div className="simulation-wrap"><div className="sim-toolbar"><span><i className="status-dot" /> RUNNING</span><span><Layers3 size={14} /> {settings.ballCount} objects</span><span><Wind size={14} /> {settings.airDrag === 0 ? "No drag" : `${settings.airDrag.toFixed(2)} drag`}</span></div><canvas ref={canvasRef} className="physics-canvas" aria-label="Bouncing ball physics simulation" /><div className="sim-caption"><span>Every bounce is calculated in real time.</span><span>Drag values to change the system.</span></div></div>
        </section>
        <footer className="bounce-footer"><span>Bounce Lab <i>/</i> a tiny laboratory for big forces</span><span>Gravity · momentum · energy</span></footer>
      </main>
    </div>
  );
}
