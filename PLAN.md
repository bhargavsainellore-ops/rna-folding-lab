# Game Plan: Bounce Lab

## Risk Tasks

### 1. Real-time 2D physics loop
- **Why isolated:** Canvas animation must stay smooth while controls change simulation parameters and the viewport resizes.
- **Approach:** Keep the simulation state in refs, clamp frame delta, use deterministic circle-wall collisions, and rebuild the ball set when the count changes.
- **Verify:** Balls respond immediately to gravity, restitution, air drag, pause/resume, reset, and count changes without duplicate loops or visual jitter.

## Main Build

Bounce Lab is a browser-based physics playground at `/bounce`. It presents a control deck beside a live simulation chamber with adjustable gravity, launch height, ball count, restitution, and air drag. The interface should feel like a small instrument panel: dark chamber, warm floor, saturated balls, concise readouts, and clear live status.

- **Assets needed:** Generated visual reference for the dark editorial simulation chamber; the actual balls, grid, chamber, and floor are rendered procedurally for crisp responsive performance.
- **Verify:**
  - Physics objects respond to gravity and collisions.
  - Control changes are reflected in the next simulation frame.
  - Pause and reset work without stale animation loops.
  - UI remains readable and avoids overflow at desktop and mobile sizes.
  - No browser console errors during capture.
  - The final view matches the reference palette, density, and composition.
