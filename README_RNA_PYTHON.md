# Python RNA structure predictor

`rna_structure_predictor.py` accepts an RNA sequence such as `AUG GCU AUC CAG UAA`, removes spaces, folds the sequence with ViennaRNA, and writes a real 2D secondary-structure drawing.

## Install

```bash
python -m pip install ViennaRNA
```

For PNG output, also install:

```bash
python -m pip install cairosvg
```

## Run

```bash
python rna_structure_predictor.py "AUG GCU AUC CAG UAA" --png
```

Generated files are saved in `rna_results/`:

- `rna_structure.svg` — the visual stem/loop structure drawing
- `rna_structure.png` — optional raster image
- `rna_structure.dotbracket.txt` — machine-readable structure notation
- `rna_structure.json` — sequence, minimum free energy, and output paths

You can also read a FASTA or plain-text file:

```bash
python rna_structure_predictor.py --file sequence.fasta --png
```

This predicts **secondary structure**, which is the standard sequence-to-stem/loop folding result. It does not generate a validated 3D molecular structure; 3D prediction needs a separate structure-prediction workflow and usually a longer sequence with biological context.
