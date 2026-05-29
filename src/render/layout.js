const DEFAULT_LAYOUT = {
  width: 1000,
  height: 650,
  margin: 80,
  nodeRadius: 8,
};

function endpoints(component) {
  switch (component.type) {
    case 'resistor':
      return { a: component.nodeA, b: component.nodeB };
    case 'voltageSource':
      return { a: component.positiveNode, b: component.negativeNode };
    case 'currentSource':
      return { a: component.fromNode, b: component.toNode };
    default:
      throw new Error(`Unknown component type: ${component.type}`);
  }
}

function buildUndirectedAdjacency(netlist) {
  const adjacency = new Map([...netlist.nodes].map((n) => [n, new Set()]));
  for (const component of netlist.components) {
    const { a, b } = endpoints(component);
    adjacency.get(a)?.add(b);
    adjacency.get(b)?.add(a);
  }
  return adjacency;
}

function bfsLevels(adjacency, root) {
  const level = new Map();
  const queue = [root];
  level.set(root, 0);

  while (queue.length > 0) {
    const node = queue.shift();
    const nextLevel = level.get(node) + 1;
    const neighbors = [...(adjacency.get(node) ?? [])].sort();
    for (const neighbor of neighbors) {
      if (level.has(neighbor)) continue;
      level.set(neighbor, nextLevel);
      queue.push(neighbor);
    }
  }
  return level;
}

export function layoutNetlist(netlist, options = {}) {
  const config = { ...DEFAULT_LAYOUT, ...options };
  const { width, height, margin, nodeRadius } = config;

  const adjacency = buildUndirectedAdjacency(netlist);
  const levels = bfsLevels(adjacency, netlist.ground);

  const nodes = [...netlist.nodes].sort((a, b) => {
    const la = levels.get(a) ?? Number.MAX_SAFE_INTEGER;
    const lb = levels.get(b) ?? Number.MAX_SAFE_INTEGER;
    if (la !== lb) return la - lb;
    return a.localeCompare(b);
  });

  const byLevel = new Map();
  for (const node of nodes) {
    const l = levels.get(node) ?? 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l).push(node);
  }

  const maxLevel = Math.max(...byLevel.keys());
  const usableW = Math.max(1, width - 2 * margin);
  const usableH = Math.max(1, height - 2 * margin);

  const positions = new Map();
  for (const [l, levelNodes] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
    const x = margin + (maxLevel === 0 ? usableW / 2 : (usableW * l) / maxLevel);
    const count = levelNodes.length;
    for (let idx = 0; idx < count; idx += 1) {
      const y = margin + (count === 1 ? usableH / 2 : (usableH * idx) / (count - 1));
      positions.set(levelNodes[idx], { x, y });
    }
  }

  const components = netlist.components.map((component) => {
    const { a, b } = endpoints(component);
    const p1 = positions.get(a);
    const p2 = positions.get(b);
    if (!p1 || !p2) {
      throw new Error('Layout failed to position all component endpoints');
    }
    return {
      component,
      fromNode: a,
      toNode: b,
      p1,
      p2,
    };
  });

  return {
    width,
    height,
    margin,
    nodeRadius,
    positions,
    components,
  };
}

