import test from 'node:test';
import assert from 'node:assert/strict';
import { Netlist } from '../src/engine/circuit.js';
import { equivalentResistance } from '../src/engine/measure.js';

const closeTo = (actual, expected, tolerance = 1e-6) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
};

test('equivalentResistance computes Thevenin resistance with sources powered off', () => {
  // Circuit:
  // V1 forces n1 at 10V (will be shorted when powered off).
  // R1 between n1-n2 (1k), R2 between n2-0 (2k).
  // With V1 off => n1 short to 0, so R_th between n2 and 0 is R1 || R2.
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('V1', 'n1', '0', 10)
    .addResistor('R1', 'n1', 'n2', 1000)
    .addResistor('R2', 'n2', '0', 2000);

  const result = equivalentResistance(circuit, 'n2', '0');
  assert.equal(result.ok, true);
  closeTo(result.resistanceOhms, 1 / (1 / 1000 + 1 / 2000));
});

