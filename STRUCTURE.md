# Bounce Lab Structure

- `client/src/pages/BounceLab.tsx`: responsive page shell, control deck, canvas simulation loop, and live metrics.
- `client/src/App.tsx`: `/bounce` route alongside the RNA Folding Lab route.
- `client/src/index.css`: shared typography plus Bounce Lab-specific dark instrument-panel styling.
- `PLAN.md`: risk slices and verification criteria.
- `ASSETS.md`: generated visual reference and art direction.

The simulation is intentionally self-contained and front-end only. It uses the canvas 2D API for a lightweight, inspectable physics playground rather than a server or external physics API.
