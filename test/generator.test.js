import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCircuit } from '../src/engine/generator.js';
import { solveMNA } from '../src/engine/circuit.js';

function derivedLoopCount(netlist) {
  // For a connected undirected graph: loops = edges - vertices + 1
  return netlist.components.length - netlist.nodes.size + 1;
}

test('generateCircuit creates a solvable non-trivial circuit within constraints', () => {
  const { netlist, solution, meta } = generateCircuit({
    seed: 'phase2-alpha',
    minComponents: 5,
    maxComponents: 10,
    minLoops: 2,
    maxLoops: 4,
  });

  assert.ok(meta.componentCount >= 5 && meta.componentCount <= 10);
  assert.ok(meta.loopCount >= 2 && meta.loopCount <= 4);
  assert.equal(netlist.components.length, meta.componentCount);
  assert.equal(netlist.nodes.size, meta.nodeCount);
  assert.equal(derivedLoopCount(netlist), meta.loopCount);

  assert.ok(netlist.components.some((c) => c.type === 'voltageSource'));
  assert.ok(Object.values(solution.nodeVoltages).every((v) => Number.isFinite(v)));

  // Re-solving is stable and produces the same voltages.
  const again = solveMNA(netlist);
  assert.deepEqual(again.nodeVoltages, solution.nodeVoltages);
});

test('generateCircuit is deterministic for the same seed', () => {
  const a = generateCircuit({ seed: 'phase2-deterministic' });
  const b = generateCircuit({ seed: 'phase2-deterministic' });

  assert.deepEqual(a.netlist.components, b.netlist.components);
  assert.deepEqual([...a.netlist.nodes].sort(), [...b.netlist.nodes].sort());
  assert.deepEqual(a.solution.nodeVoltages, b.solution.nodeVoltages);
  assert.deepEqual(a.solution.branchCurrents, b.solution.branchCurrents);
});

test('generateCircuit supports difficulty=easy (linear only)', () => {
  const { netlist, solution, meta } = generateCircuit({ seed: 'diff-easy', difficulty: 'easy' });

  assert.equal(meta.difficulty, 'easy');
  assert.ok(meta.loopCount >= 1 && meta.loopCount <= 2);
  assert.ok(Object.values(solution.nodeVoltages).every((v) => Number.isFinite(v)));
  assert.ok(netlist.components.every((c) => ['resistor', 'voltageSource', 'currentSource'].includes(c.type)));
});

test('generateCircuit supports difficulty=medium (introduces non-linear components)', () => {
  const { netlist, solution, meta } = generateCircuit({ seed: 'diff-medium', difficulty: 'medium' });

  assert.equal(meta.difficulty, 'medium');
  assert.ok(meta.loopCount >= 2 && meta.loopCount <= 3);
  assert.ok(Object.values(solution.nodeVoltages).every((v) => Number.isFinite(v)));

  assert.ok(
    netlist.components.some((c) => ['diode', 'zenerDiode', 'bjtNpn', 'bjtPnp', 'mosfetN', 'mosfetP'].includes(c.type)),
  );
});

test('generateCircuit supports difficulty=hard (includes ideal op-amp)', () => {
  const { netlist, solution, meta } = generateCircuit({ seed: 'diff-hard', difficulty: 'hard' });

  assert.equal(meta.difficulty, 'hard');
  assert.ok(Object.values(solution.nodeVoltages).every((v) => Number.isFinite(v)));
  assert.ok(netlist.components.some((c) => c.type === 'idealOpAmp'));
});
