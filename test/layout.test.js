import test from 'node:test';
import assert from 'node:assert/strict';
import { Netlist } from '../src/engine/circuit.js';
import { layoutNetlist } from '../src/render/layout.js';

function snapshotPositions(layout) {
  return [...layout.positions.entries()]
    .map(([node, p]) => [node, Number(p.x.toFixed(6)), Number(p.y.toFixed(6))])
    .sort((a, b) => a[0].localeCompare(b[0]));
}

test('layoutNetlist positions all nodes deterministically', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('V1', 'n1', '0', 12)
    .addResistor('R1', 'n1', 'n2', 2000)
    .addResistor('R2', 'n2', '0', 1000)
    .addResistor('R3', 'n2', 'n3', 1500)
    .addResistor('R4', 'n3', '0', 750);

  const a = layoutNetlist(circuit, { width: 900, height: 600 });
  const b = layoutNetlist(circuit, { width: 900, height: 600 });

  assert.equal(a.positions.size, circuit.nodes.size);
  assert.equal(a.components.length, circuit.components.length);
  assert.deepEqual(snapshotPositions(a), snapshotPositions(b));

  for (const [, p] of a.positions.entries()) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.x >= 0 && p.x <= 900);
    assert.ok(p.y >= 0 && p.y <= 600);
  }
});

