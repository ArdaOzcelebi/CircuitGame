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

test('solves a diode clipper DC operating point (non-linear)', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('V1', 'vin', '0', 5)
    .addResistor('R1', 'vin', 'vout', 1000)
    .addDiode('D1', 'vout', '0');

  const result = solveMNA(circuit);

  assert.ok(result.nodeVoltages.vout > 0.45 && result.nodeVoltages.vout < 0.8);
  closeTo(result.nodeVoltages.vin, 5);
  closeTo(result.branchCurrents.R1, (5 - result.nodeVoltages.vout) / 1000, 1e-9);
  assert.ok(result.branchCurrents.D1 > 0.001 && result.branchCurrents.D1 < 0.02);
});

test('solves an inverting ideal op-amp amplifier (linear)', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('Vin', 'vin', '0', 1)
    .addResistor('Rin', 'vin', 'nminus', 1000)
    .addResistor('Rf', 'out', 'nminus', 10000)
    .addIdealOpAmp('U1', '0', 'nminus', 'out', '0', { openLoopGain: 1e9 });

  const result = solveMNA(circuit);

  closeTo(result.nodeVoltages.nminus, 0, 1e-6);
  closeTo(result.nodeVoltages.out, -10, 1e-3);
});

test('solves a simple zener regulator operating point (non-linear)', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('V1', 'vin', '0', 12)
    .addResistor('R1', 'vin', 'vout', 1000)
    .addZenerDiode('Z1', '0', 'vout', { breakdownVoltageVolts: 5.1, dynamicResistanceOhms: 10 });

  const result = solveMNA(circuit);

  assert.ok(result.nodeVoltages.vout > 4.5 && result.nodeVoltages.vout < 6.5);
  assert.ok(result.branchCurrents.Z1 < 0);
});

test('solves an NPN switch (non-linear)', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('VCC', 'vcc', '0', 5)
    .addVoltageSource('VBB', 'vbb', '0', 5)
    .addResistor('RC', 'vcc', 'c', 1000)
    .addResistor('RB', 'vbb', 'b', 100000)
    .addBjtNpn('Q1', 'c', 'b', '0', { beta: 100 });

  const result = solveMNA(circuit);

  assert.ok(result.nodeVoltages.c >= 0 && result.nodeVoltages.c < 1.5);
  assert.ok(result.branchCurrents.Q1 > 0.001);
});

test('solves an NMOS low-side switch (non-linear)', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('VCC', 'vcc', '0', 5)
    .addVoltageSource('VG', 'g', '0', 5)
    .addResistor('RL', 'vcc', 'd', 1000)
    .addMosfetNChannel('M1', 'd', 'g', '0', {
      thresholdVoltageVolts: 2.0,
      onResistanceOhms: 5,
      offResistanceOhms: 1e9,
      smoothingVolts: 0.05,
    });

  const result = solveMNA(circuit);

  assert.ok(result.nodeVoltages.d >= 0 && result.nodeVoltages.d < 0.5);
});
