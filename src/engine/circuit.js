const EPSILON = 1e-12;
const DEFAULT_THERMAL_VOLTAGE = 0.02585;
const DEFAULT_DIODE_SATURATION_CURRENT = 1e-12;
const DEFAULT_OPAMP_OPEN_LOOP_GAIN = 1e6;
const DEFAULT_ZENER_BREAKDOWN_VOLTAGE = 5.1;
const DEFAULT_ZENER_DYNAMIC_RESISTANCE_OHMS = 10;
const DEFAULT_BJT_BETA = 100;
const DEFAULT_MOSFET_THRESHOLD_VOLTS = 2.5;
const DEFAULT_MOSFET_ON_RESISTANCE_OHMS = 10;
const DEFAULT_MOSFET_OFF_RESISTANCE_OHMS = 1e9;
const DEFAULT_MOSFET_SMOOTHING_VOLTS = 0.05;

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

  addDiode(
    id,
    anodeNode,
    cathodeNode,
    {
      saturationCurrentAmps = DEFAULT_DIODE_SATURATION_CURRENT,
      emissionCoefficient = 1,
      thermalVoltageVolts = DEFAULT_THERMAL_VOLTAGE,
    } = {},
  ) {
    if (saturationCurrentAmps <= 0) {
      throw new Error('Diode saturation current must be > 0');
    }
    if (emissionCoefficient <= 0) {
      throw new Error('Diode emission coefficient must be > 0');
    }
    if (thermalVoltageVolts <= 0) {
      throw new Error('Diode thermal voltage must be > 0');
    }
    this.#addNode(anodeNode);
    this.#addNode(cathodeNode);
    this.components.push({
      type: 'diode',
      id,
      anodeNode,
      cathodeNode,
      saturationCurrentAmps,
      emissionCoefficient,
      thermalVoltageVolts,
    });
    return this;
  }

  addIdealOpAmp(
    id,
    nonInvertingNode,
    invertingNode,
    outputNode,
    referenceNode = this.ground,
    { openLoopGain = DEFAULT_OPAMP_OPEN_LOOP_GAIN } = {},
  ) {
    if (!Number.isFinite(openLoopGain) || openLoopGain <= 0) {
      throw new Error('Op-amp open-loop gain must be a finite number > 0');
    }
    this.#addNode(nonInvertingNode);
    this.#addNode(invertingNode);
    this.#addNode(outputNode);
    this.#addNode(referenceNode);
    this.components.push({
      type: 'idealOpAmp',
      id,
      nonInvertingNode,
      invertingNode,
      outputNode,
      referenceNode,
      openLoopGain,
    });
    return this;
  }

  addZenerDiode(
    id,
    anodeNode,
    cathodeNode,
    {
      breakdownVoltageVolts = DEFAULT_ZENER_BREAKDOWN_VOLTAGE,
      dynamicResistanceOhms = DEFAULT_ZENER_DYNAMIC_RESISTANCE_OHMS,
      saturationCurrentAmps = DEFAULT_DIODE_SATURATION_CURRENT,
      emissionCoefficient = 1,
      thermalVoltageVolts = DEFAULT_THERMAL_VOLTAGE,
    } = {},
  ) {
    if (!Number.isFinite(breakdownVoltageVolts) || breakdownVoltageVolts <= 0) {
      throw new Error('Zener breakdown voltage must be a finite number > 0');
    }
    if (!Number.isFinite(dynamicResistanceOhms) || dynamicResistanceOhms <= 0) {
      throw new Error('Zener dynamic resistance must be a finite number > 0');
    }
    if (saturationCurrentAmps <= 0) {
      throw new Error('Zener saturation current must be > 0');
    }
    if (emissionCoefficient <= 0) {
      throw new Error('Zener emission coefficient must be > 0');
    }
    if (thermalVoltageVolts <= 0) {
      throw new Error('Zener thermal voltage must be > 0');
    }
    this.#addNode(anodeNode);
    this.#addNode(cathodeNode);
    this.components.push({
      type: 'zenerDiode',
      id,
      anodeNode,
      cathodeNode,
      breakdownVoltageVolts,
      dynamicResistanceOhms,
      saturationCurrentAmps,
      emissionCoefficient,
      thermalVoltageVolts,
    });
    return this;
  }

  addBjtNpn(
    id,
    collectorNode,
    baseNode,
    emitterNode,
    {
      beta = DEFAULT_BJT_BETA,
      saturationCurrentAmps = DEFAULT_DIODE_SATURATION_CURRENT,
      emissionCoefficient = 1,
      thermalVoltageVolts = DEFAULT_THERMAL_VOLTAGE,
    } = {},
  ) {
    if (!Number.isFinite(beta) || beta <= 0) {
      throw new Error('BJT beta must be a finite number > 0');
    }
    if (saturationCurrentAmps <= 0) {
      throw new Error('BJT saturation current must be > 0');
    }
    if (emissionCoefficient <= 0) {
      throw new Error('BJT emission coefficient must be > 0');
    }
    if (thermalVoltageVolts <= 0) {
      throw new Error('BJT thermal voltage must be > 0');
    }
    this.#addNode(collectorNode);
    this.#addNode(baseNode);
    this.#addNode(emitterNode);
    this.components.push({
      type: 'bjtNpn',
      id,
      collectorNode,
      baseNode,
      emitterNode,
      beta,
      saturationCurrentAmps,
      emissionCoefficient,
      thermalVoltageVolts,
    });
    return this;
  }

  addBjtPnp(
    id,
    collectorNode,
    baseNode,
    emitterNode,
    {
      beta = DEFAULT_BJT_BETA,
      saturationCurrentAmps = DEFAULT_DIODE_SATURATION_CURRENT,
      emissionCoefficient = 1,
      thermalVoltageVolts = DEFAULT_THERMAL_VOLTAGE,
    } = {},
  ) {
    if (!Number.isFinite(beta) || beta <= 0) {
      throw new Error('BJT beta must be a finite number > 0');
    }
    if (saturationCurrentAmps <= 0) {
      throw new Error('BJT saturation current must be > 0');
    }
    if (emissionCoefficient <= 0) {
      throw new Error('BJT emission coefficient must be > 0');
    }
    if (thermalVoltageVolts <= 0) {
      throw new Error('BJT thermal voltage must be > 0');
    }
    this.#addNode(collectorNode);
    this.#addNode(baseNode);
    this.#addNode(emitterNode);
    this.components.push({
      type: 'bjtPnp',
      id,
      collectorNode,
      baseNode,
      emitterNode,
      beta,
      saturationCurrentAmps,
      emissionCoefficient,
      thermalVoltageVolts,
    });
    return this;
  }

  addMosfetNChannel(
    id,
    drainNode,
    gateNode,
    sourceNode,
    {
      thresholdVoltageVolts = DEFAULT_MOSFET_THRESHOLD_VOLTS,
      onResistanceOhms = DEFAULT_MOSFET_ON_RESISTANCE_OHMS,
      offResistanceOhms = DEFAULT_MOSFET_OFF_RESISTANCE_OHMS,
      smoothingVolts = DEFAULT_MOSFET_SMOOTHING_VOLTS,
    } = {},
  ) {
    if (!Number.isFinite(thresholdVoltageVolts)) {
      throw new Error('MOSFET threshold voltage must be finite');
    }
    if (!Number.isFinite(onResistanceOhms) || onResistanceOhms <= 0) {
      throw new Error('MOSFET on-resistance must be a finite number > 0');
    }
    if (!Number.isFinite(offResistanceOhms) || offResistanceOhms <= 0) {
      throw new Error('MOSFET off-resistance must be a finite number > 0');
    }
    if (!Number.isFinite(smoothingVolts) || smoothingVolts <= 0) {
      throw new Error('MOSFET smoothing volts must be a finite number > 0');
    }
    this.#addNode(drainNode);
    this.#addNode(gateNode);
    this.#addNode(sourceNode);
    this.components.push({
      type: 'mosfetN',
      id,
      drainNode,
      gateNode,
      sourceNode,
      thresholdVoltageVolts,
      onResistanceOhms,
      offResistanceOhms,
      smoothingVolts,
    });
    return this;
  }

  addMosfetPChannel(
    id,
    drainNode,
    gateNode,
    sourceNode,
    {
      thresholdVoltageVolts = DEFAULT_MOSFET_THRESHOLD_VOLTS,
      onResistanceOhms = DEFAULT_MOSFET_ON_RESISTANCE_OHMS,
      offResistanceOhms = DEFAULT_MOSFET_OFF_RESISTANCE_OHMS,
      smoothingVolts = DEFAULT_MOSFET_SMOOTHING_VOLTS,
    } = {},
  ) {
    if (!Number.isFinite(thresholdVoltageVolts)) {
      throw new Error('MOSFET threshold voltage must be finite');
    }
    if (!Number.isFinite(onResistanceOhms) || onResistanceOhms <= 0) {
      throw new Error('MOSFET on-resistance must be a finite number > 0');
    }
    if (!Number.isFinite(offResistanceOhms) || offResistanceOhms <= 0) {
      throw new Error('MOSFET off-resistance must be a finite number > 0');
    }
    if (!Number.isFinite(smoothingVolts) || smoothingVolts <= 0) {
      throw new Error('MOSFET smoothing volts must be a finite number > 0');
    }
    this.#addNode(drainNode);
    this.#addNode(gateNode);
    this.#addNode(sourceNode);
    this.components.push({
      type: 'mosfetP',
      id,
      drainNode,
      gateNode,
      sourceNode,
      thresholdVoltageVolts,
      onResistanceOhms,
      offResistanceOhms,
      smoothingVolts,
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
  const diodes = netlist.components.filter((c) => c.type === 'diode');
  const zenerDiodes = netlist.components.filter((c) => c.type === 'zenerDiode');
  const bjts = netlist.components.filter((c) => c.type === 'bjtNpn' || c.type === 'bjtPnp');
  const mosfets = netlist.components.filter((c) => c.type === 'mosfetN' || c.type === 'mosfetP');
  const opAmps = netlist.components.filter((c) => c.type === 'idealOpAmp');

  const n = nodes.length;
  const m = voltageSources.length;
  const p = opAmps.length;
  const size = n + m + p;

  if (size === 0) {
    return {
      nodeVoltages: { [netlist.ground]: 0 },
      branchCurrents: {},
    };
  }

  const idx = (node) => {
    if (node === netlist.ground) return -1;
    return nodeIndex.get(node);
  };

  let x;

  const hasNonLinear = diodes.length + zenerDiodes.length + bjts.length + mosfets.length > 0;

  if (!hasNonLinear) {
    const { A, z } = buildMnaSystem({
      netlist,
      idx,
      voltageSources,
      diodes,
      zenerDiodes,
      bjts,
      mosfets,
      opAmps,
      guessNodeVoltages: Array(n).fill(0),
      n,
      m,
      size,
    });
    x = solveLinearSystem(A, z);
  } else {
    const maxIterations = 80;
    const tolerance = 1e-9;
    const nodeStepLimitVolts = 0.5;

    x = Array(size).fill(0);

    let converged = false;
    for (let iter = 0; iter < maxIterations; iter += 1) {
      const guessNodeVoltages = Array(n).fill(0);
      for (let i = 0; i < n; i += 1) {
        guessNodeVoltages[i] = x[i];
      }

      const { A, z } = buildMnaSystem({
        netlist,
        idx,
        voltageSources,
        diodes,
        zenerDiodes,
        bjts,
        mosfets,
        opAmps,
        guessNodeVoltages,
        n,
        m,
        size,
      });

      const xNew = solveLinearSystem(A, z);

      const { nextX, maxStep } = applyLimitedUpdate(x, xNew, {
        nodeCount: n,
        nodeStepLimitVolts,
      });
      x = nextX;

      if (maxStep <= tolerance) {
        converged = true;
        break;
      }
    }

    if (!converged) {
      throw new Error('Non-linear solver did not converge');
    }
  }

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
    } else if (component.type === 'diode') {
      const vA = nodeVoltages[component.anodeNode] ?? 0;
      const vC = nodeVoltages[component.cathodeNode] ?? 0;
      branchCurrents[component.id] = diodeCurrentFromVoltage(component, vA - vC);
    } else if (component.type === 'zenerDiode') {
      const vA = nodeVoltages[component.anodeNode] ?? 0;
      const vC = nodeVoltages[component.cathodeNode] ?? 0;
      branchCurrents[component.id] = zenerCurrentFromVoltage(component, vA - vC);
    } else if (component.type === 'bjtNpn' || component.type === 'bjtPnp') {
      branchCurrents[component.id] = bjtCollectorCurrentFromVoltages(component, nodeVoltages);
    } else if (component.type === 'mosfetN' || component.type === 'mosfetP') {
      branchCurrents[component.id] = mosfetDrainCurrentFromVoltages(component, nodeVoltages);
    }
  }

  voltageSources.forEach((source, k) => {
    branchCurrents[source.id] = x[n + k];
  });

  opAmps.forEach((opAmp, k) => {
    branchCurrents[opAmp.id] = x[n + m + k];
  });

  return { nodeVoltages, branchCurrents };
}

function buildMnaSystem({
  netlist,
  idx,
  voltageSources,
  diodes,
  zenerDiodes,
  bjts,
  mosfets,
  opAmps,
  guessNodeVoltages,
  n,
  m,
  size,
}) {
  const A = Array.from({ length: size }, () => Array(size).fill(0));
  const z = Array(size).fill(0);

  const nodeVoltage = (nodeId) => {
    if (nodeId === netlist.ground) return 0;
    const i = idx(nodeId);
    if (i < 0) return 0;
    return guessNodeVoltages[i] ?? 0;
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

  for (const diode of diodes) {
    const vD = nodeVoltage(diode.anodeNode) - nodeVoltage(diode.cathodeNode);
    const { conductanceSiemens, equivalentCurrentAmps } = linearizeDiode(diode, vD);

    const i = idx(diode.anodeNode);
    const j = idx(diode.cathodeNode);
    if (i >= 0) A[i][i] += conductanceSiemens;
    if (j >= 0) A[j][j] += conductanceSiemens;
    if (i >= 0 && j >= 0) {
      A[i][j] -= conductanceSiemens;
      A[j][i] -= conductanceSiemens;
    }

    if (i >= 0) z[i] -= equivalentCurrentAmps;
    if (j >= 0) z[j] += equivalentCurrentAmps;
  }

  for (const zener of zenerDiodes) {
    const vD = nodeVoltage(zener.anodeNode) - nodeVoltage(zener.cathodeNode);
    const { conductanceSiemens, equivalentCurrentAmps } = linearizeZener(zener, vD);

    const i = idx(zener.anodeNode);
    const j = idx(zener.cathodeNode);
    if (i >= 0) A[i][i] += conductanceSiemens;
    if (j >= 0) A[j][j] += conductanceSiemens;
    if (i >= 0 && j >= 0) {
      A[i][j] -= conductanceSiemens;
      A[j][i] -= conductanceSiemens;
    }

    if (i >= 0) z[i] -= equivalentCurrentAmps;
    if (j >= 0) z[j] += equivalentCurrentAmps;
  }

  for (const bjt of bjts) {
    stampBjt(A, z, bjt, { idx, nodeVoltage });
  }

  for (const mosfet of mosfets) {
    stampMosfetConductance(A, mosfet, { idx, nodeVoltage });
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

  opAmps.forEach((opAmp, k) => {
    const rowCol = n + m + k;
    const out = idx(opAmp.outputNode);
    const ref = idx(opAmp.referenceNode);
    const nonInv = idx(opAmp.nonInvertingNode);
    const inv = idx(opAmp.invertingNode);

    if (out >= 0) {
      A[out][rowCol] += 1;
      A[rowCol][out] += 1;
    }
    if (ref >= 0) {
      A[ref][rowCol] -= 1;
      A[rowCol][ref] -= 1;
    }

    if (nonInv >= 0) A[rowCol][nonInv] -= opAmp.openLoopGain;
    if (inv >= 0) A[rowCol][inv] += opAmp.openLoopGain;
  });

  return { A, z };
}

function applyLimitedUpdate(x, xNew, { nodeCount, nodeStepLimitVolts }) {
  const nextX = [...x];
  let maxStep = 0;

  for (let i = 0; i < x.length; i += 1) {
    let step = xNew[i] - x[i];
    if (i < nodeCount && Number.isFinite(nodeStepLimitVolts)) {
      step = clamp(step, -nodeStepLimitVolts, nodeStepLimitVolts);
    }
    nextX[i] = x[i] + step;
    maxStep = Math.max(maxStep, Math.abs(step));
  }

  return { nextX, maxStep };
}

function linearizeDiode(diode, vD) {
  const { saturationCurrentAmps: Is, emissionCoefficient: n, thermalVoltageVolts: Vt } = diode;
  const x = vD / (n * Vt);
  const expX = safeExp(x);
  const i = Is * (expX - 1);
  const g = (Is / (n * Vt)) * expX;
  const iEq = i - g * vD;
  return { conductanceSiemens: g, equivalentCurrentAmps: iEq };
}

function diodeCurrentFromVoltage(diode, vD) {
  const { saturationCurrentAmps: Is, emissionCoefficient: n, thermalVoltageVolts: Vt } = diode;
  const x = vD / (n * Vt);
  const expX = safeExp(x);
  return Is * (expX - 1);
}

function linearizeZener(zener, vD) {
  const { breakdownVoltageVolts: Vz, dynamicResistanceOhms: rZ } = zener;

  if (vD >= 0) {
    return linearizeDiode(zener, vD);
  }

  if (vD <= -Vz) {
    const g = 1 / rZ;
    const i = (vD + Vz) * g;
    const iEq = i - g * vD;
    return { conductanceSiemens: g, equivalentCurrentAmps: iEq };
  }

  // Between 0 and breakdown: keep a tiny conductance to avoid numerical dead-ends.
  const gLeak = 1e-12;
  const iLeak = gLeak * vD;
  const iEq = iLeak - gLeak * vD;
  return { conductanceSiemens: gLeak, equivalentCurrentAmps: iEq };
}

function zenerCurrentFromVoltage(zener, vD) {
  const { breakdownVoltageVolts: Vz, dynamicResistanceOhms: rZ } = zener;
  if (vD >= 0) return diodeCurrentFromVoltage(zener, vD);
  if (vD <= -Vz) return (vD + Vz) / rZ;
  return 0;
}

function stampBjt(A, z, bjt, { idx, nodeVoltage }) {
  const c = bjt.collectorNode;
  const b = bjt.baseNode;
  const e = bjt.emitterNode;

  if (bjt.type === 'bjtNpn') {
    stampDiodeBetweenNodes(A, z, b, e, bjt, { idx, nodeVoltage });
    stampBjtCollectorCurrentNpn(A, z, bjt, { idx, nodeVoltage });
    return;
  }

  if (bjt.type === 'bjtPnp') {
    stampDiodeBetweenNodes(A, z, e, b, bjt, { idx, nodeVoltage });
    stampBjtCollectorCurrentPnp(A, z, bjt, { idx, nodeVoltage });
    return;
  }

  throw new Error(`Unknown BJT type: ${bjt.type} (${bjt.id}) between ${c},${b},${e}`);
}

function stampDiodeBetweenNodes(A, z, anodeNode, cathodeNode, diodeLike, { idx, nodeVoltage }) {
  const vD = nodeVoltage(anodeNode) - nodeVoltage(cathodeNode);
  const { conductanceSiemens, equivalentCurrentAmps } = linearizeDiode(diodeLike, vD);

  const i = idx(anodeNode);
  const j = idx(cathodeNode);
  if (i >= 0) A[i][i] += conductanceSiemens;
  if (j >= 0) A[j][j] += conductanceSiemens;
  if (i >= 0 && j >= 0) {
    A[i][j] -= conductanceSiemens;
    A[j][i] -= conductanceSiemens;
  }

  if (i >= 0) z[i] -= equivalentCurrentAmps;
  if (j >= 0) z[j] += equivalentCurrentAmps;
}

function stampVccs(A, z, fromNode, toNode, controlPosNode, controlNegNode, g, iEq, idx) {
  const from = idx(fromNode);
  const to = idx(toNode);
  const cp = idx(controlPosNode);
  const cn = idx(controlNegNode);

  if (from >= 0) {
    if (cp >= 0) A[from][cp] += g;
    if (cn >= 0) A[from][cn] -= g;
    z[from] -= iEq;
  }
  if (to >= 0) {
    if (cp >= 0) A[to][cp] -= g;
    if (cn >= 0) A[to][cn] += g;
    z[to] += iEq;
  }
}

function stampBjtCollectorCurrentNpn(A, z, bjt, { idx, nodeVoltage }) {
  const vForward = nodeVoltage(bjt.baseNode) - nodeVoltage(bjt.emitterNode);
  const { g, iEq } = linearizeBetaTimesForwardDiodeCurrent(bjt, vForward);
  stampVccs(A, z, bjt.collectorNode, bjt.emitterNode, bjt.baseNode, bjt.emitterNode, g, iEq, idx);
}

function stampBjtCollectorCurrentPnp(A, z, bjt, { idx, nodeVoltage }) {
  const vForward = nodeVoltage(bjt.emitterNode) - nodeVoltage(bjt.baseNode);
  const { g, iEq } = linearizeBetaTimesForwardDiodeCurrent(bjt, vForward);
  stampVccs(A, z, bjt.emitterNode, bjt.collectorNode, bjt.emitterNode, bjt.baseNode, g, iEq, idx);
}

function linearizeBetaTimesForwardDiodeCurrent(bjt, vForward) {
  if (vForward <= 0) {
    return { g: 0, iEq: 0 };
  }
  const diodeLin = linearizeDiode(bjt, vForward);
  const i = bjt.beta * (diodeCurrentFromVoltage(bjt, vForward) > 0 ? diodeCurrentFromVoltage(bjt, vForward) : 0);
  const g = bjt.beta * diodeLin.conductanceSiemens;
  const iEq = i - g * vForward;
  return { g, iEq };
}

function bjtCollectorCurrentFromVoltages(bjt, nodeVoltages) {
  const vB = nodeVoltages[bjt.baseNode] ?? 0;
  const vE = nodeVoltages[bjt.emitterNode] ?? 0;
  if (bjt.type === 'bjtNpn') {
    const vForward = vB - vE;
    if (vForward <= 0) return 0;
    const i = diodeCurrentFromVoltage(bjt, vForward);
    return bjt.beta * Math.max(0, i);
  }
  if (bjt.type === 'bjtPnp') {
    const vForward = vE - vB;
    if (vForward <= 0) return 0;
    const i = diodeCurrentFromVoltage(bjt, vForward);
    return -bjt.beta * Math.max(0, i);
  }
  return 0;
}

function stampMosfetConductance(A, mosfet, { idx, nodeVoltage }) {
  const g = mosfetConductance(mosfet, { nodeVoltage });
  stampConductanceBetweenNodes(A, mosfet.drainNode, mosfet.sourceNode, g, idx);
}

function stampConductanceBetweenNodes(A, nodeA, nodeB, g, idx) {
  const i = idx(nodeA);
  const j = idx(nodeB);
  if (i >= 0) A[i][i] += g;
  if (j >= 0) A[j][j] += g;
  if (i >= 0 && j >= 0) {
    A[i][j] -= g;
    A[j][i] -= g;
  }
}

function mosfetConductance(mosfet, { nodeVoltage }) {
  const gOn = 1 / mosfet.onResistanceOhms;
  const gOff = 1 / mosfet.offResistanceOhms;
  const k = mosfet.smoothingVolts;

  if (mosfet.type === 'mosfetN') {
    const vgs = nodeVoltage(mosfet.gateNode) - nodeVoltage(mosfet.sourceNode);
    const t = sigmoid((vgs - mosfet.thresholdVoltageVolts) / k);
    return gOff + (gOn - gOff) * t;
  }

  if (mosfet.type === 'mosfetP') {
    const vsg = nodeVoltage(mosfet.sourceNode) - nodeVoltage(mosfet.gateNode);
    const t = sigmoid((vsg - mosfet.thresholdVoltageVolts) / k);
    return gOff + (gOn - gOff) * t;
  }

  return gOff;
}

function mosfetDrainCurrentFromVoltages(mosfet, nodeVoltages) {
  const nodeVoltage = (nodeId) => nodeVoltages[nodeId] ?? 0;
  const g = mosfetConductance(mosfet, { nodeVoltage });
  const vD = nodeVoltage(mosfet.drainNode);
  const vS = nodeVoltage(mosfet.sourceNode);
  return g * (vD - vS);
}

function sigmoid(x) {
  // Clamp input to keep exp stable.
  const clamped = clamp(x, -40, 40);
  return 1 / (1 + Math.exp(-clamped));
}

function safeExp(x) {
  if (x > 40) return Math.exp(40);
  if (x < -40) return Math.exp(-40);
  return Math.exp(x);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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
