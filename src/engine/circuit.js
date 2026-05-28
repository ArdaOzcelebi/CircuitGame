const EPSILON = 1e-12;

export class Netlist {
  constructor({ ground = '0' } = {}) {
    this.ground = ground;
    this.nodes = new Set([ground]);
    this.components = [];
  }

  addResistor(id, nodeA, nodeB, resistanceOhms) {
    if (resistanceOhms <= 0) {
      throw new Error('Resistor value must be > 0');
    }
    this.#addNode(nodeA);
    this.#addNode(nodeB);
    this.components.push({ type: 'resistor', id, nodeA, nodeB, resistanceOhms });
    return this;
  }

  addVoltageSource(id, positiveNode, negativeNode, voltageVolts) {
    this.#addNode(positiveNode);
    this.#addNode(negativeNode);
    this.components.push({
      type: 'voltageSource',
      id,
      positiveNode,
      negativeNode,
      voltageVolts,
    });
    return this;
  }

  addCurrentSource(id, fromNode, toNode, currentAmps) {
    this.#addNode(fromNode);
    this.#addNode(toNode);
    this.components.push({
      type: 'currentSource',
      id,
      fromNode,
      toNode,
      currentAmps,
    });
    return this;
  }

  #addNode(nodeId) {
    this.nodes.add(nodeId);
  }
}

export function solveMNA(netlist) {
  const nodes = [...netlist.nodes].filter((n) => n !== netlist.ground);
  const nodeIndex = new Map(nodes.map((n, i) => [n, i]));
  const voltageSources = netlist.components.filter((c) => c.type === 'voltageSource');

  const n = nodes.length;
  const m = voltageSources.length;
  const size = n + m;

  if (size === 0) {
    return {
      nodeVoltages: { [netlist.ground]: 0 },
      branchCurrents: {},
    };
  }

  const A = Array.from({ length: size }, () => Array(size).fill(0));
  const z = Array(size).fill(0);

  const idx = (node) => {
    if (node === netlist.ground) return -1;
    return nodeIndex.get(node);
  };

  for (const component of netlist.components) {
    if (component.type === 'resistor') {
      const g = 1 / component.resistanceOhms;
      const i = idx(component.nodeA);
      const j = idx(component.nodeB);
      if (i >= 0) A[i][i] += g;
      if (j >= 0) A[j][j] += g;
      if (i >= 0 && j >= 0) {
        A[i][j] -= g;
        A[j][i] -= g;
      }
    }

    if (component.type === 'currentSource') {
      const i = idx(component.fromNode);
      const j = idx(component.toNode);
      if (i >= 0) z[i] -= component.currentAmps;
      if (j >= 0) z[j] += component.currentAmps;
    }
  }

  voltageSources.forEach((source, k) => {
    const rowCol = n + k;
    const i = idx(source.positiveNode);
    const j = idx(source.negativeNode);

    if (i >= 0) {
      A[i][rowCol] += 1;
      A[rowCol][i] += 1;
    }
    if (j >= 0) {
      A[j][rowCol] -= 1;
      A[rowCol][j] -= 1;
    }

    z[rowCol] += source.voltageVolts;
  });

  const x = solveLinearSystem(A, z);

  const nodeVoltages = { [netlist.ground]: 0 };
  for (const [nodeId, i] of nodeIndex.entries()) {
    nodeVoltages[nodeId] = x[i];
  }

  const branchCurrents = {};
  for (const component of netlist.components) {
    if (component.type === 'resistor') {
      const vA = nodeVoltages[component.nodeA] ?? 0;
      const vB = nodeVoltages[component.nodeB] ?? 0;
      branchCurrents[component.id] = (vA - vB) / component.resistanceOhms;
    } else if (component.type === 'currentSource') {
      branchCurrents[component.id] = component.currentAmps;
    }
  }

  voltageSources.forEach((source, k) => {
    branchCurrents[source.id] = x[n + k];
  });

  return { nodeVoltages, branchCurrents };
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const A = matrix.map((row) => [...row]);
  const b = [...vector];

  for (let p = 0; p < n; p += 1) {
    let max = p;
    for (let r = p + 1; r < n; r += 1) {
      if (Math.abs(A[r][p]) > Math.abs(A[max][p])) {
        max = r;
      }
    }

    if (Math.abs(A[max][p]) < EPSILON) {
      throw new Error('Circuit is singular or unsolvable');
    }

    [A[p], A[max]] = [A[max], A[p]];
    [b[p], b[max]] = [b[max], b[p]];

    for (let r = p + 1; r < n; r += 1) {
      const factor = A[r][p] / A[p][p];
      if (Math.abs(factor) < EPSILON) continue;
      for (let c = p; c < n; c += 1) {
        A[r][c] -= factor * A[p][c];
      }
      b[r] -= factor * b[p];
    }
  }

  const x = Array(n).fill(0);
  for (let r = n - 1; r >= 0; r -= 1) {
    let sum = b[r];
    for (let c = r + 1; c < n; c += 1) {
      sum -= A[r][c] * x[c];
    }
    x[r] = sum / A[r][r];
  }

  return x;
}
