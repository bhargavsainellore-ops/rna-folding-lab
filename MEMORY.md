# Memory

Bounce Lab is implemented as a second route in the existing WebDev project because this session permits one managed project initialization. The route is `/bounce` and is front-end only. The simulation uses one canvas animation loop with refs for mutable physics state, a clamped timestep, circle-to-wall collision response, and settings-driven gravity, launch height, ball count, restitution, and air drag.

Visual verification completed at 1280×900 and 375×812. The desktop screenshot shows the control deck, simulation chamber, live status, and five bouncing balls. The mobile screenshot shows the responsive intro, readout, and chamber without horizontal overflow. TypeScript and language-service checks report zero errors.
