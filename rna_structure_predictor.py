#!/usr/bin/env python3
"""Predict and draw an RNA secondary structure.

Examples:
    python rna_structure_predictor.py "AUG GCU AUC CAG UAA"
    python rna_structure_predictor.py --sequence "GGGAAAUCCGAGUUUACGCGAAACUCGCAUUGCCGGA" --png

The output is a 2D secondary-structure drawing, not a 3D molecular model.
ViennaRNA is used for thermodynamic folding rather than a simple heuristic.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Optional


def normalize_sequence(raw: str) -> str:
    """Accept spaces, FASTA headers, line breaks, and DNA T bases."""
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    sequence = "".join(line for line in lines if not line.startswith(">"))
    sequence = "".join(sequence.split()).upper().replace("T", "U")
    return sequence


def validate_sequence(sequence: str) -> None:
    if not sequence:
        raise ValueError("The RNA sequence is empty.")
    invalid = sorted(set(sequence) - set("AUCG"))
    if invalid:
        raise ValueError(
            f"Invalid base(s): {', '.join(invalid)}. Use only A, U, C, and G."
        )
    if len(sequence) < 4:
        raise ValueError("Use at least 4 bases to predict a structure.")


def fold_with_viennarna(sequence: str) -> tuple[str, float, str]:
    """Return (dot_bracket, mfe_kcal_mol, svg) using the ViennaRNA Python API."""
    try:
        import RNA  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "ViennaRNA is not installed. Run: python -m pip install ViennaRNA"
        ) from exc

    fold_compound = RNA.fold_compound(sequence)
    structure, mfe = fold_compound.mfe()
    # ViennaRNA's native drawing is a conventional 2D stem/loop diagram.
    # Current bindings write the SVG to a file and return a success flag.
    with tempfile.NamedTemporaryFile(suffix=".svg", delete=False) as temp_file:
        temp_path = Path(temp_file.name)
    try:
        if not RNA.svg_rna_plot(sequence, structure, str(temp_path)):
            raise RuntimeError("ViennaRNA could not draw the predicted structure.")
        svg = temp_path.read_text(encoding="utf-8")
    finally:
        temp_path.unlink(missing_ok=True)
    return structure, float(mfe), svg


def fold_with_rnafold_cli(sequence: str) -> tuple[str, float, str]:
    """Fallback for systems with RNAfold/RNAplot executables but no Python binding."""
    if not shutil.which("RNAfold") or not shutil.which("RNAplot"):
        raise RuntimeError(
            "Neither the ViennaRNA Python package nor RNAfold/RNAplot was found. "
            "Install with: python -m pip install ViennaRNA"
        )

    folded = subprocess.run(
        ["RNAfold", "--noPS"],
        input=f">sequence\n{sequence}\n",
        text=True,
        capture_output=True,
        check=True,
    ).stdout.splitlines()
    structure_line = next((line for line in folded if "(" in line and ")" in line), "")
    if not structure_line:
        raise RuntimeError("RNAfold returned no structure.")
    structure = structure_line.split()[0]
    mfe_text = structure_line[structure_line.find("(") + 1 : structure_line.rfind(")")]
    mfe = float(mfe_text)

    plot = subprocess.run(
        ["RNAplot", "--output-format=svg"],
        input=f">sequence\n{sequence}\n{structure}\n",
        text=True,
        capture_output=True,
        check=True,
    )
    svg_path = Path("rna.ss.svg")
    if not svg_path.exists():
        raise RuntimeError("RNAplot did not create an SVG drawing.")
    svg = svg_path.read_text(encoding="utf-8")
    svg_path.unlink(missing_ok=True)
    return structure, mfe, svg


def save_png(svg_path: Path, png_path: Path) -> None:
    """Convert SVG to PNG when cairosvg is available."""
    try:
        import cairosvg  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "PNG export needs cairosvg. Run: python -m pip install cairosvg"
        ) from exc
    try:
        cairosvg.svg2png(url=str(svg_path), write_to=str(png_path), output_width=1600)
    except OSError as exc:
        raise RuntimeError(
            "PNG export needs the native Cairo library. The SVG was created successfully; "
            "open the SVG file instead, or install Cairo separately on Windows."
        ) from exc


def predict(raw_sequence: str, output_dir: Path, prefix: str, make_png: bool) -> dict:
    sequence = normalize_sequence(raw_sequence)
    validate_sequence(sequence)

    try:
        structure, mfe, svg = fold_with_viennarna(sequence)
    except RuntimeError as python_error:
        # Keep the fallback useful on machines where the CLI was installed instead.
        try:
            structure, mfe, svg = fold_with_rnafold_cli(sequence)
        except RuntimeError:
            raise python_error

    output_dir.mkdir(parents=True, exist_ok=True)
    svg_path = output_dir / f"{prefix}.svg"
    dot_path = output_dir / f"{prefix}.dotbracket.txt"
    json_path = output_dir / f"{prefix}.json"

    svg_path.write_text(svg, encoding="utf-8")
    dot_path.write_text(
        f">sequence\n{sequence}\n{structure}\nMFE: {mfe:.2f} kcal/mol\n",
        encoding="utf-8",
    )
    result = {
        "sequence": sequence,
        "length": len(sequence),
        "secondary_structure": structure,
        "minimum_free_energy_kcal_per_mol": round(mfe, 2),
        "drawing_svg": str(svg_path),
        "dot_bracket_file": str(dot_path),
        "note": "This is a predicted 2D secondary structure, not a validated 3D structure.",
    }
    json_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    if make_png:
        try:
            save_png(svg_path, output_dir / f"{prefix}.png")
            result["drawing_png"] = str(output_dir / f"{prefix}.png")
        except RuntimeError as warning:
            result["png_warning"] = str(warning)

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Predict and draw an RNA secondary structure with ViennaRNA."
    )
    parser.add_argument(
        "sequence",
        nargs="?",
        help="RNA sequence, for example: 'AUG GCU AUC CAG UAA'",
    )
    parser.add_argument("--file", type=Path, help="Read a sequence or FASTA file")
    parser.add_argument("--output-dir", type=Path, default=Path("rna_results"))
    parser.add_argument("--prefix", default="rna_structure")
    parser.add_argument("--png", action="store_true", help="Also export a PNG drawing")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.file:
        raw = args.file.read_text(encoding="utf-8")
    elif args.sequence:
        raw = args.sequence
    else:
        raw = input("Paste an RNA sequence: ")

    try:
        result = predict(raw, args.output_dir, args.prefix, args.png)
    except (ValueError, RuntimeError, OSError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    print("RNA secondary structure predicted successfully.\n")
    print(f"Sequence: {result['sequence']}")
    print(f"Structure: {result['secondary_structure']}")
    print(f"MFE:      {result['minimum_free_energy_kcal_per_mol']:.2f} kcal/mol")
    print(f"Drawing:  {result['drawing_svg']}")
    if "drawing_png" in result:
        print(f"PNG:      {result['drawing_png']}")
    elif "png_warning" in result:
        print(f"PNG note: {result['png_warning']}")
    print(f"Metadata: {result['json_path'] if 'json_path' in result else args.output_dir / (args.prefix + '.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
