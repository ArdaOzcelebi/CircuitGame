import { equivalentResistance, measureVoltage } from '../engine/measure.js';
import { Netlist } from '../engine/circuit.js';

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

function pickTwoDistinct(rng, options) {
  if (options.length < 2) {
    throw new Error('Need at least 2 options to pick distinct items');
  }
  const aIndex = randInt(rng, 0, options.length - 1);
  let bIndex = randInt(rng, 0, options.length - 2);
  if (bIndex >= aIndex) bIndex += 1;
  return [options[aIndex], options[bIndex]];
}

function toleranceFor(kind, answer) {
  const abs = Math.abs(answer);
  const relTol = 0.02; // 1–2% spec: use 2% consistently
  if (abs === 0) return 0;
  return abs * relTol;
}

function componentDirectionText(component) {
  if (component.type === 'resistor') return `positive from ${component.nodeA} to ${component.nodeB}`;
  if (component.type === 'currentSource') return `positive from ${component.fromNode} to ${component.toNode}`;
  if (component.type === 'voltageSource') return `positive from ${component.positiveNode} to ${component.negativeNode}`;
  return '';
}

function componentTerminals(component) {
  if (component.type === 'resistor') return { a: component.nodeA, b: component.nodeB };
  if (component.type === 'currentSource') return { a: component.fromNode, b: component.toNode };
  if (component.type === 'voltageSource') return { a: component.positiveNode, b: component.negativeNode };
  return null;
}

function solutionMagnitudeOk(kind, answer) {
  const abs = Math.abs(answer);
  if (!Number.isFinite(abs)) return false;
  if (kind === 'voltage') return abs >= 0.05;
  if (kind === 'current') return abs >= 0.00001;
  if (kind === 'resistance') return abs >= 1;
  if (kind === 'power') return abs >= 0.00001;
  return abs > 0;
}

function makeVoltageQuestion({ rng, netlist, solution, seed, index }) {
  const nodes = [...netlist.nodes].sort();
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const [redNode, blackNode] = pickTwoDistinct(rng, nodes);
    const answer = measureVoltage(solution, redNode, blackNode);
    if (!solutionMagnitudeOk('voltage', answer)) continue;

    return {
      id: `${seed}:q${index}:V`,
      kind: 'voltage',
      unit: 'V',
      prompt: `What is V(${redNode}) − V(${blackNode})?`,
      answer,
      tolerance: toleranceFor('voltage', answer),
      meta: { redNode, blackNode },
    };
  }

  const [redNode, blackNode] = pickTwoDistinct(rng, nodes);
  const answer = measureVoltage(solution, redNode, blackNode);
  return {
    id: `${seed}:q${index}:V`,
    kind: 'voltage',
    unit: 'V',
    prompt: `What is V(${redNode}) − V(${blackNode})?`,
    answer,
    tolerance: toleranceFor('voltage', answer),
    meta: { redNode, blackNode },
  };
}

function makeCurrentQuestion({ rng, netlist, solution, seed, index }) {
  const components = netlist.components;
  if (components.length === 0) return null;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const component = components[randInt(rng, 0, components.length - 1)];
    const answer = solution.branchCurrents[component.id];
    if (!solutionMagnitudeOk('current', answer)) continue;
    const dir = componentDirectionText(component);
    return {
      id: `${seed}:q${index}:A:${component.id}`,
      kind: 'current',
      unit: 'A',
      prompt: `What is the current through ${component.id}?`,
      answer,
      tolerance: toleranceFor('current', answer),
      meta: { componentId: component.id, direction: dir },
    };
  }
  return null;
}

function makeResistanceQuestion({ rng, netlist, seed, index }) {
  const nodes = [...netlist.nodes].sort();
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const [nodeA, nodeB] = pickTwoDistinct(rng, nodes);
    const result = equivalentResistance(netlist, nodeA, nodeB);
    if (!result.ok) continue;
    if (!Number.isFinite(result.resistanceOhms)) continue;
    const answer = result.resistanceOhms;
    if (!solutionMagnitudeOk('resistance', answer)) continue;
    return {
      id: `${seed}:q${index}:R`,
      kind: 'resistance',
      unit: 'Ω',
      prompt: `What is the equivalent resistance between ${nodeA} and ${nodeB} (sources off)?`,
      answer,
      tolerance: toleranceFor('resistance', answer),
      meta: { nodeA, nodeB },
    };
  }
  return null;
}

function makeVoltageDropQuestion({ rng, netlist, solution, seed, index }) {
  const components = netlist.components.filter((c) => c.type === 'resistor' || c.type === 'voltageSource');
  if (components.length === 0) return null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const component = components[randInt(rng, 0, components.length - 1)];
    const terminals = componentTerminals(component);
    if (!terminals) continue;

    const answer = measureVoltage(solution, terminals.a, terminals.b);
    if (!solutionMagnitudeOk('voltage', answer)) continue;

    return {
      id: `${seed}:q${index}:VD:${component.id}`,
      kind: 'voltage',
      unit: 'V',
      prompt: `What is the voltage drop across ${component.id} (from ${terminals.a} to ${terminals.b})?`,
      answer,
      tolerance: toleranceFor('voltage', answer),
      meta: { componentId: component.id, nodeA: terminals.a, nodeB: terminals.b },
    };
  }

  return null;
}

function makePowerQuestion({ rng, netlist, solution, seed, index }) {
  const resistors = netlist.components.filter((c) => c.type === 'resistor');
  if (resistors.length === 0) return null;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const resistor = resistors[randInt(rng, 0, resistors.length - 1)];
    const current = solution.branchCurrents[resistor.id];
    if (!solutionMagnitudeOk('current', current)) continue;
    const powerWatts = current * current * resistor.resistanceOhms;
    if (!solutionMagnitudeOk('power', powerWatts)) continue;

    return {
      id: `${seed}:q${index}:P:${resistor.id}`,
      kind: 'power',
      unit: 'W',
      prompt: `What is the power dissipated by ${resistor.id}?`,
      answer: powerWatts,
      tolerance: toleranceFor('power', powerWatts),
      meta: { componentId: resistor.id },
    };
  }

  return null;
}

function netlistWithOtherSourcesPoweredOff(netlist, { excludeVoltageSourceId } = {}) {
  const off = new Netlist({ ground: netlist.ground });
  for (const component of netlist.components) {
    if (component.type === 'resistor') {
      off.addResistor(component.id, component.nodeA, component.nodeB, component.resistanceOhms);
    } else if (component.type === 'voltageSource') {
      if (component.id === excludeVoltageSourceId) continue;
      off.addVoltageSource(component.id, component.positiveNode, component.negativeNode, 0);
    } else if (component.type === 'currentSource') {
      // Powered off => open circuit (remove).
    } else {
      throw new Error(`Unknown component type: ${component.type}`);
    }
  }
  return off;
}

function makeInputResistanceQuestion({ rng, netlist, seed, index }) {
  const sources = netlist.components.filter((c) => c.type === 'voltageSource');
  if (sources.length === 0) return null;

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const source = sources[randInt(rng, 0, sources.length - 1)];
    const off = netlistWithOtherSourcesPoweredOff(netlist, { excludeVoltageSourceId: source.id });
    const result = equivalentResistance(off, source.positiveNode, source.negativeNode);
    if (!result.ok || !Number.isFinite(result.resistanceOhms)) continue;
    const answer = result.resistanceOhms;
    if (!solutionMagnitudeOk('resistance', answer)) continue;

    return {
      id: `${seed}:q${index}:RIN:${source.id}`,
      kind: 'resistance',
      unit: 'Ω',
      prompt: `What resistance does the circuit present to ${source.id} (sources off, excluding ${source.id})?`,
      answer,
      tolerance: toleranceFor('resistance', answer),
      meta: { sourceId: source.id, nodeA: source.positiveNode, nodeB: source.negativeNode },
    };
  }

  return null;
}

export function generateQuizQuestions({ netlist, solution, seed, count = 5 } = {}) {
  if (!netlist?.nodes || !Array.isArray(netlist?.components)) {
    throw new Error('generateQuizQuestions: invalid netlist');
  }
  if (!solution?.nodeVoltages || !solution?.branchCurrents) {
    throw new Error('generateQuizQuestions: invalid solution');
  }

  const quizSeed = seed ?? 'quiz';
  const rng = makeRng(quizSeed);
  const kinds = ['voltage', 'current', 'resistance', 'voltageDrop', 'power', 'inputResistance'];

  const questions = [];
  for (let i = 0; i < count; i += 1) {
    const kind = pick(rng, kinds);
    let question = null;

    if (kind === 'voltage') {
      question = makeVoltageQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    } else if (kind === 'current') {
      question = makeCurrentQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    } else if (kind === 'resistance') {
      question = makeResistanceQuestion({ rng, netlist, seed: quizSeed, index: i });
    } else if (kind === 'voltageDrop') {
      question = makeVoltageDropQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    } else if (kind === 'power') {
      question = makePowerQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    } else if (kind === 'inputResistance') {
      question = makeInputResistanceQuestion({ rng, netlist, seed: quizSeed, index: i });
    }

    if (!question) {
      question = makeVoltageQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    }

    if (!Number.isFinite(question.answer)) {
      question = makeVoltageQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    }
    if (!Number.isFinite(question.tolerance) || question.tolerance <= 0) {
      question = makeVoltageQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    }

    questions.push(question);
  }

  return questions;
}

export function gradeQuizAnswer(question, userValue) {
  if (!question || !Number.isFinite(question.answer) || !Number.isFinite(question.tolerance)) {
    throw new Error('gradeQuizAnswer: invalid question');
  }
  if (!Number.isFinite(userValue)) {
    return { ok: false, correct: false, error: 'Enter a valid number' };
  }

  const delta = userValue - question.answer;
  const correct = Math.abs(delta) <= question.tolerance;
  return { ok: true, correct, delta, tolerance: question.tolerance };
}
