# CircuitGame
A random circuit generator. Do your measurements to learn electronic circuits.

## Current implementation status
- ✅ Phase 1: Circuit data model + Modified Nodal Analysis solver
- ✅ Phase 2: Procedural random (solvable) circuit generator
- ⏳ Phase 3+: Renderer, multimeter, and game loop are pending

## Development
- Run tests: `npm test`

## Engine modules
- Solver: `src/engine/circuit.js` (`Netlist`, `solveMNA`)
- Generator: `src/engine/generator.js` (`generateCircuit`)
