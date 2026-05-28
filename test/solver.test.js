import test from 'node:test';
import assert from 'node:assert/strict';
import { Netlist, solveMNA } from '../src/engine/circuit.js';

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('solves a simple voltage divider with a DC source', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('V1', 'n1', '0', 12)
    .addResistor('R1', 'n1', 'n2', 2000)
    .addResistor('R2', 'n2', '0', 1000);

  const result = solveMNA(circuit);

  closeTo(result.nodeVoltages.n1, 12);
  closeTo(result.nodeVoltages.n2, 4);
  closeTo(result.branchCurrents.R1, 0.004);
  closeTo(result.branchCurrents.R2, 0.004);
  closeTo(result.branchCurrents.V1, -0.004);
});

test('solves a resistor with a current source sink to ground', () => {
  const circuit = new Netlist({ ground: '0' })
    .addResistor('R1', 'n1', '0', 1000)
    .addCurrentSource('I1', 'n1', '0', 0.002);

  const result = solveMNA(circuit);

  closeTo(result.nodeVoltages.n1, -2);
  closeTo(result.branchCurrents.R1, -0.002);
  closeTo(result.branchCurrents.I1, 0.002);
});
