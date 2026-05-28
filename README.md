# CircuitGame
A random circuit generator. Do your measurements to learn electronic circuits.

## Current implementation status
- ✅ Phase 1: Circuit data model + Modified Nodal Analysis solver
- ✅ Phase 2: Procedural random (solvable) circuit generator
- ✅ Phase 3: Canvas schematic renderer + current-flow animation (basic)
- ⏳ Phase 4+: Multimeter and game loop are pending

## Development
- Run tests: `npm test`
- Run local app: `npm start` (then open http://localhost:5173)

## Engine modules
- Solver: `src/engine/circuit.js` (`Netlist`, `solveMNA`)
- Generator: `src/engine/generator.js` (`generateCircuit`)

## Renderer modules
- Layout: `src/render/layout.js` (`layoutNetlist`)
- Canvas renderer: `src/render/renderer.js` (`createCircuitRenderer`)
