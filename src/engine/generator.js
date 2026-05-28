import { Netlist, solveMNA } from './circuit.js';

const DEFAULTS = {
  ground: '0',
  minComponents: 5,
  maxComponents: 10,
  minLoops: 2,
  maxLoops: 4,
  maxAttempts: 250,
};

function fnv1a32(input) {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  if (seed === undefined || seed === null) {
    return mulberry32((Math.random() * 2 ** 32) >>> 0);
  }
  if (Number.isInteger(seed)) {
    return mulberry32(seed >>> 0);
  }
  return mulberry32(fnv1a32(seed));
}

function randInt(rng, minInclusive, maxInclusive) {
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(rng() * span);
}

function pick(rng, options) {
  return options[randInt(rng, 0, options.length - 1)];
}

function edgeKey(a, b) {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function chooseTopology(rng, { minComponents, maxComponents, minLoops, maxLoops }) {
  // Undirected simple graph: loops = edges - vertices + 1 (connected).
  // Choose vertices so that a unique-edge graph can support 2–4 loops while staying within 5–10 components.
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const vertices = randInt(rng, 5, 7); // includes ground
    const loops = randInt(rng, minLoops, maxLoops);
    const edges = vertices - 1 + loops;
    const maxUniqueEdges = (vertices * (vertices - 1)) / 2;

    if (edges < minComponents || edges > maxComponents) continue;
    if (edges > maxUniqueEdges) continue;
    return { vertices, edges, loops };
  }
  throw new Error('Unable to choose topology within constraints');
}

function buildConnectedEdges(rng, nodeIds, edgesTarget) {
  const edges = [];
  const used = new Set();

  // Spanning tree, force first non-ground node to connect to ground.
  edges.push({ a: nodeIds[0], b: nodeIds[1] });
  used.add(edgeKey(nodeIds[0], nodeIds[1]));

  for (let i = 2; i < nodeIds.length; i += 1) {
    const a = nodeIds[i];
    const b = nodeIds[randInt(rng, 0, i - 1)];
    edges.push({ a, b });
    used.add(edgeKey(a, b));
  }

  while (edges.length < edgesTarget) {
    const a = nodeIds[randInt(rng, 0, nodeIds.length - 1)];
    const b = nodeIds[randInt(rng, 0, nodeIds.length - 1)];
    if (a === b) continue;
    const key = edgeKey(a, b);
    if (used.has(key)) continue;
    used.add(key);
    edges.push({ a, b });
  }

  return edges;
}

function resistorOhms(rng) {
  return pick(rng, [100, 220, 330, 470, 680, 1000, 2200, 3300, 4700, 6800, 10000]);
}

function voltageVolts(rng) {
  return pick(rng, [5, 9, 12, 15, 18, 24]);
}

function currentAmps(rng) {
  return pick(rng, [0.001, 0.002, 0.003, 0.005, 0.01]);
}

function buildNetlistFromEdges(rng, ground, edges, vertexCount) {
  const netlist = new Netlist({ ground });

  // Use the guaranteed ground-connected first edge as V1 to avoid floating solutions.
  const [vEdge, ...otherEdges] = edges;
  netlist.addVoltageSource('V1', vEdge.b, vEdge.a, voltageVolts(rng));

  // Keep the spanning-tree portion resistive for numerical stability; allow a small number of
  // current sources only on the extra loop-forming edges.
  const maxCurrentSources = Math.min(2, Math.max(0, otherEdges.length - 3));
  let currentSourcesLeft = randInt(rng, 0, maxCurrentSources);
  const treeEdgesRemaining = Math.max(0, vertexCount - 2);

  let r = 1;
  let i = 1;

  otherEdges.forEach((edge, index) => {
    const isExtraEdge = index >= treeEdgesRemaining;
    const shouldBeCurrentSource = isExtraEdge && currentSourcesLeft > 0 && rng() < 0.4;

    if (shouldBeCurrentSource) {
      currentSourcesLeft -= 1;
      // Conventional sign: fromNode -> toNode currentAmps.
      netlist.addCurrentSource(`I${i}`, edge.a, edge.b, currentAmps(rng));
      i += 1;
      return;
    }

    netlist.addResistor(`R${r}`, edge.a, edge.b, resistorOhms(rng));
    r += 1;
  });

  return netlist;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function generateCircuit(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const {
    seed,
    ground,
    minComponents,
    maxComponents,
    minLoops,
    maxLoops,
    maxAttempts,
  } = config;

  if (minComponents < 3) throw new Error('minComponents must be >= 3');
  if (maxComponents < minComponents) throw new Error('maxComponents must be >= minComponents');
  if (minLoops < 0) throw new Error('minLoops must be >= 0');
  if (maxLoops < minLoops) throw new Error('maxLoops must be >= minLoops');

  const rng = makeRng(seed);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { vertices, edges, loops } = chooseTopology(rng, {
      minComponents,
      maxComponents,
      minLoops,
      maxLoops,
    });

    const nodeIds = [ground, ...Array.from({ length: vertices - 1 }, (_, idx) => `n${idx + 1}`)];
    const edgeList = buildConnectedEdges(rng, nodeIds, edges);
    const netlist = buildNetlistFromEdges(rng, ground, edgeList, nodeIds.length);

    try {
      const solution = solveMNA(netlist);
      const allFinite = Object.values(solution.nodeVoltages).every(isFiniteNumber);
      if (!allFinite) continue;

      return {
        netlist,
        solution,
        meta: {
          seed,
          nodeCount: netlist.nodes.size,
          componentCount: netlist.components.length,
          loopCount: loops,
        },
      };
    } catch {
      // Regenerate on singular/unsolvable graphs.
    }
  }

  throw new Error(`Unable to generate solvable circuit after ${maxAttempts} attempts`);
}
