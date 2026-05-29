import { equivalentResistance, measureVoltage } from '../engine/measure.js';

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
  if (kind === 'voltage') return Math.max(abs * 0.02, 0.005); // 2% or 5 mV
  if (kind === 'current') return Math.max(abs * 0.03, 0.000005); // 3% or 5 µA
  if (kind === 'resistance') return Math.max(abs * 0.05, 0.5); // 5% or 0.5 Ω
  return Math.max(abs * 0.02, 0.001);
}

function componentDirectionText(component) {
  if (component.type === 'resistor') return `positive from ${component.nodeA} to ${component.nodeB}`;
  if (component.type === 'currentSource') return `positive from ${component.fromNode} to ${component.toNode}`;
  if (component.type === 'voltageSource') return `positive from ${component.positiveNode} to ${component.negativeNode}`;
  return '';
}

function makeVoltageQuestion({ rng, netlist, solution, seed, index }) {
  const nodes = [...netlist.nodes].sort();
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
    if (!Number.isFinite(answer)) continue;
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

export function generateQuizQuestions({ netlist, solution, seed, count = 5 } = {}) {
  if (!netlist?.nodes || !Array.isArray(netlist?.components)) {
    throw new Error('generateQuizQuestions: invalid netlist');
  }
  if (!solution?.nodeVoltages || !solution?.branchCurrents) {
    throw new Error('generateQuizQuestions: invalid solution');
  }

  const quizSeed = seed ?? 'quiz';
  const rng = makeRng(quizSeed);
  const kinds = ['voltage', 'current', 'resistance'];

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
    }

    if (!question) {
      question = makeVoltageQuestion({ rng, netlist, solution, seed: quizSeed, index: i });
    }

    if (!Number.isFinite(question.answer)) {
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

