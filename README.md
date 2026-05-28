# CircuitGame
A random circuit generator. Do your measurements to learn electronic circuits.

## Current implementation status
- ✅ Phase 1: Circuit data model + Modified Nodal Analysis solver
- ✅ Phase 2: Procedural random (solvable) circuit generator
- ✅ Phase 3: Canvas schematic renderer + current-flow animation (basic)
- ✅ Phase 4: Multimeter UI + draggable probes (V/A/Ω)
- ⏳ Phase 5: Game loop / quiz is pending

## Development
- Run tests: `npm test`
- Run local app: `npm start` (then open http://localhost:5173)

## Multimeter (demo)
- `V`: drag probes onto two nodes to read `V_red − V_black`
- `A`: drag the red probe onto a branch to read that branch current (conventional direction per component definition)
- `Ω`: drag probes onto two nodes to read Thevenin equivalent resistance (sources powered off)

## Engine modules
- Solver: `src/engine/circuit.js` (`Netlist`, `solveMNA`)
- Generator: `src/engine/generator.js` (`generateCircuit`)
- Measurements: `src/engine/measure.js` (`measureVoltage`, `equivalentResistance`)

## Renderer modules
- Layout: `src/render/layout.js` (`layoutNetlist`)
- Canvas renderer: `src/render/renderer.js` (`createCircuitRenderer`)

## UI modules
- Multimeter controller: `src/ui/multimeter.js` (`createMultimeterController`)
- Hit testing: `src/ui/hitTest.js` (`nearestNode`, `nearestComponent`)
