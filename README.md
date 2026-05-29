# CircuitGame
A random circuit generator. Do your measurements to learn electronic circuits.

## Current implementation status
- ✅ Phase 1: Circuit data model + Modified Nodal Analysis solver
- ✅ Phase 2: Procedural random (solvable) circuit generator
- ✅ Phase 3: Canvas schematic renderer + current-flow animation (basic)
- ✅ Phase 4: Multimeter UI + draggable probes (V/A/Ω)
- ✅ Phase 5: Game loop / quiz + scoring

## Development
- Run tests: `npm test`
- Run local app: `npm start` (then open http://localhost:5173)

## V2 features (high level)
- Non-linear DC operating point solving (Newton-style linearization) for diodes + simple Zener/BJT/MOSFET models
- Ideal op-amp support (high-gain VCVS model)
- Difficulty modes: Easy / Medium / Hard (UI dropdown)
- Pan/zoom: mouse wheel zoom, drag background to pan
- Probe snapping + reset: probes magnetically snap while dragging; press `R` to reset (ghost probes show last position)
- Educational layer: progressive 3-level hints + dynamic Manual (glossary + basic topology detection)

## Multimeter (demo)
- `V`: drag probes onto two nodes to read `V_red − V_black`
- `A`: drag the red probe onto a branch to read that branch current (conventional direction per component definition)
- `Ω`: drag probes onto two nodes to read Thevenin equivalent resistance (sources powered off)

## Quiz (Phase 5)
- Use the quiz card to answer measurement questions about the current circuit.
- Enter a numeric answer in the unit shown and press Submit (or Enter).
- After submitting, press Next (or Enter again) to advance.
- Use "New Quiz" to regenerate questions for the same circuit (score resets).
- Expand "Solutions" to view the exact answers and tolerances for the current quiz.
- Use "Hint" up to 3 times per question for progressively more specific guidance.

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
- Manual panel: `src/ui/manual.js` (`createManualController`)
