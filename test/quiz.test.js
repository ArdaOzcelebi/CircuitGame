import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCircuit } from '../src/engine/generator.js';
import { generateQuizQuestions, gradeQuizAnswer } from '../src/quiz/generateQuiz.js';

test('generateQuizQuestions is deterministic for the same seed and circuit', () => {
  const { netlist, solution } = generateCircuit({ seed: 'phase5-quiz-circuit' });

  const a = generateQuizQuestions({ netlist, solution, seed: 'phase5-quiz', count: 12 });
  const b = generateQuizQuestions({ netlist, solution, seed: 'phase5-quiz', count: 12 });

  assert.deepEqual(a, b);

  for (const q of a) {
    assert.ok(typeof q.id === 'string' && q.id.length > 0);
    assert.ok(['voltage', 'current', 'resistance'].includes(q.kind));
    assert.ok(typeof q.prompt === 'string' && q.prompt.length > 0);
    assert.ok(Number.isFinite(q.answer));
    assert.ok(Number.isFinite(q.tolerance));
    assert.ok(q.tolerance > 0);

    if (q.kind === 'voltage') assert.equal(q.unit, 'V');
    if (q.kind === 'current') assert.equal(q.unit, 'A');
    if (q.kind === 'resistance') assert.equal(q.unit, 'Ω');
  }
});

test('generateQuizQuestions can generate a resistance question', () => {
  const { netlist, solution } = generateCircuit({ seed: 'phase5-quiz-circuit-2' });

  const seeds = ['r0', 'r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  let found = null;
  for (const seed of seeds) {
    const questions = generateQuizQuestions({ netlist, solution, seed, count: 10 });
    found = questions.find((q) => q.kind === 'resistance') ?? null;
    if (found) break;
  }

  assert.ok(found, 'expected at least one resistance question');
  assert.ok(Number.isFinite(found.answer));
});

test('gradeQuizAnswer accepts answers within tolerance', () => {
  const question = {
    id: 'q1',
    kind: 'voltage',
    unit: 'V',
    prompt: 'test',
    answer: 10,
    tolerance: 0.5,
  };

  assert.equal(gradeQuizAnswer(question, 10.4).correct, true);
  assert.equal(gradeQuizAnswer(question, 9.6).correct, true);
  assert.equal(gradeQuizAnswer(question, 10.6).correct, false);
  assert.equal(gradeQuizAnswer(question, Number.NaN).ok, false);
});

