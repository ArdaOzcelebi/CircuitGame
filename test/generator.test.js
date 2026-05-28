import test from 'node:test';
import assert from 'node:assert/strict';
import { generateRandomCircuit } from '../src/engine/generator.js';
import { solveMNA } from '../src/engine/circuit.js';

const getComponentNodes = (component) => {
  if (component.type === 'resistor') {
    return [component.nodeA, component.nodeB];
  }
  if (component.type === 'voltageSource') {
    return [component.positiveNode, component.negativeNode];
  }
  return [component.fromNode, component.toNode];
};

const collectNodes = (netlist) => {
  const nodes = new Set([netlist.ground]);
  for (const component of netlist.components) {
    const [a, b] = getComponentNodes(component);
    nodes.add(a);
    nodes.add(b);
  }
  return nodes;
};

const collectAdjacency = (netlist) => {
  const nodes = collectNodes(netlist);
  const adjacency = new Map([...nodes].map((node) => [node, new Set()]));
  for (const component of netlist.components) {
    const [a, b] = getComponentNodes(component);
    adjacency.get(a).add(b);
    adjacency.get(b).add(a);
  }
  return adjacency;
};

const serializeNetlist = (netlist) => ({
  ground: netlist.ground,
  components: netlist.components.map((component) => ({ ...component })),
});

test('generates a solvable medium-complexity circuit', () => {
  const netlist = generateRandomCircuit({ seed: 20260528 });
  const nodeIds = collectNodes(netlist);
  const componentCount = netlist.components.length;
  const loopCount = componentCount - nodeIds.size + 1;

  assert.ok(componentCount >= 5 && componentCount <= 10);
  assert.ok(loopCount >= 2 && loopCount <= 4);
  assert.ok(netlist.components.some((component) => component.type === 'voltageSource'));
  assert.ok(netlist.components.some((component) => component.type === 'resistor'));

  const adjacency = collectAdjacency(netlist);
  const visited = new Set();
  const stack = [netlist.ground];
  while (stack.length > 0) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    for (const neighbor of adjacency.get(node)) {
      if (!visited.has(neighbor)) stack.push(neighbor);
    }
  }
  assert.equal(visited.size, nodeIds.size);

  assert.doesNotThrow(() => solveMNA(netlist));
  const { nodeVoltages, branchCurrents } = solveMNA(netlist);
  for (const node of nodeIds) {
    assert.ok(Number.isFinite(nodeVoltages[node]));
  }
  for (const component of netlist.components) {
    assert.ok(Number.isFinite(branchCurrents[component.id]));
  }
});

test('generates deterministic output for a fixed seed', () => {
  const netlistA = generateRandomCircuit({ seed: 'phase-2-seed' });
  const netlistB = generateRandomCircuit({ seed: 'phase-2-seed' });

  assert.deepStrictEqual(serializeNetlist(netlistA), serializeNetlist(netlistB));
});
