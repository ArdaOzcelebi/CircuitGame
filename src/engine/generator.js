import { Netlist } from './circuit.js';

const DEFAULTS = {
  ground: '0',
  minLoops: 2,
  maxLoops: 4,
  minComponents: 5,
  maxComponents: 10,
  minResistance: 100,
  maxResistance: 1000,
  minVoltage: 5,
  maxVoltage: 12,
  minCurrent: 0.001,
  maxCurrent: 0.01,
  maxCurrentSources: 2,
};

export function generateRandomCircuit(options = {}) {
  const settings = { ...DEFAULTS, ...options };
  const rng = createRng(settings.seed);

  const loopCount = randomInt(rng, settings.minLoops, settings.maxLoops);
  const candidateNodeCounts = [];
  const minTotalNodes = Math.max(3, settings.minComponents - loopCount + 1);
  const maxTotalNodes = Math.max(minTotalNodes, settings.maxComponents - loopCount + 1);

  for (let totalNodes = minTotalNodes; totalNodes <= maxTotalNodes; totalNodes += 1) {
    const edgeCount = totalNodes - 1 + loopCount;
    const maxEdges = (totalNodes * (totalNodes - 1)) / 2;
    if (edgeCount >= settings.minComponents && edgeCount <= settings.maxComponents && edgeCount <= maxEdges) {
      candidateNodeCounts.push(totalNodes);
    }
  }

  if (candidateNodeCounts.length === 0) {
    throw new Error('Unable to generate circuit with provided constraints');
  }

  const totalNodes = pick(rng, candidateNodeCounts);
  const targetEdges = totalNodes - 1 + loopCount;
  const nodeIds = Array.from({ length: totalNodes - 1 }, (_, i) => `n${i + 1}`);
  const allNodes = [settings.ground, ...nodeIds];
  const edges = [];
  const used = new Set();

  const addEdge = (nodeA, nodeB) => {
    const key = edgeKey(nodeA, nodeB);
    if (used.has(key)) return false;
    used.add(key);
    edges.push({ nodeA, nodeB });
    return true;
  };

  addEdge(nodeIds[0], settings.ground);
  const connected = [settings.ground, nodeIds[0]];
  for (let i = 1; i < nodeIds.length; i += 1) {
    const attachTo = pick(rng, connected);
    addEdge(nodeIds[i], attachTo);
    connected.push(nodeIds[i]);
  }

  const maxAttempts = 400;
  let attempts = 0;
  while (edges.length < targetEdges && attempts < maxAttempts) {
    const nodeA = pick(rng, allNodes);
    const nodeB = pick(rng, allNodes);
    if (nodeA === nodeB) {
      attempts += 1;
      continue;
    }
    if (addEdge(nodeA, nodeB)) {
      attempts = 0;
    } else {
      attempts += 1;
    }
  }

  if (edges.length < targetEdges) {
    throw new Error('Failed to generate enough unique edges');
  }

  const voltageCandidates = edges
    .map((edge, index) =>
      edge.nodeA === settings.ground || edge.nodeB === settings.ground ? index : null,
    )
    .filter((value) => value !== null);

  const voltageIndex = voltageCandidates.length > 0 ? pick(rng, voltageCandidates) : 0;
  const remainingIndices = edges.map((_, index) => index).filter((index) => index !== voltageIndex);
  const maxCurrentSources = Math.min(
    settings.maxCurrentSources,
    Math.max(0, remainingIndices.length - 1),
  );
  const currentSourceCount = maxCurrentSources > 0 ? randomInt(rng, 0, maxCurrentSources) : 0;
  const currentSourceIndices = new Set(pickMany(rng, remainingIndices, currentSourceCount));

  const netlist = new Netlist({ ground: settings.ground });
  let resistorIndex = 1;
  let voltageIndexCounter = 1;
  let currentIndex = 1;

  edges.forEach((edge, index) => {
    if (index === voltageIndex) {
      const [positiveNode, negativeNode] = maybeSwap(rng, edge.nodeA, edge.nodeB);
      const voltage = randomFloat(rng, settings.minVoltage, settings.maxVoltage);
      netlist.addVoltageSource(`V${voltageIndexCounter}`, positiveNode, negativeNode, voltage);
      voltageIndexCounter += 1;
      return;
    }

    if (currentSourceIndices.has(index)) {
      const [fromNode, toNode] = maybeSwap(rng, edge.nodeA, edge.nodeB);
      const current = randomFloat(rng, settings.minCurrent, settings.maxCurrent);
      netlist.addCurrentSource(`I${currentIndex}`, fromNode, toNode, current);
      currentIndex += 1;
      return;
    }

    const resistance = randomInt(rng, settings.minResistance, settings.maxResistance);
    netlist.addResistor(`R${resistorIndex}`, edge.nodeA, edge.nodeB, resistance);
    resistorIndex += 1;
  });

  return netlist;
}

function createRng(seed) {
  if (seed === undefined || seed === null) {
    return Math.random;
  }
  const seedValue = typeof seed === 'string' ? hashString(seed) : seed;
  let state = (seedValue >>> 0) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function randomFloat(rng, min, max) {
  return min + rng() * (max - min);
}

function pick(rng, items) {
  return items[randomInt(rng, 0, items.length - 1)];
}

function pickMany(rng, items, count) {
  const copy = [...items];
  const picked = [];
  for (let i = 0; i < count; i += 1) {
    const index = randomInt(rng, 0, copy.length - 1);
    picked.push(copy.splice(index, 1)[0]);
  }
  return picked;
}

function edgeKey(nodeA, nodeB) {
  return nodeA < nodeB ? `${nodeA}|${nodeB}` : `${nodeB}|${nodeA}`;
}

function maybeSwap(rng, nodeA, nodeB) {
  return rng() < 0.5 ? [nodeA, nodeB] : [nodeB, nodeA];
}
