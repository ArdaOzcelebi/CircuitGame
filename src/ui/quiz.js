import { generateQuizQuestions, gradeQuizAnswer } from '../quiz/generateQuiz.js';
import { getProgressiveHints } from '../quiz/hints.js';

function formatNumber(value, digits) {
  return Number.isFinite(value) ? value.toFixed(digits) : String(value);
}

function formatSI(value, unit, { signed = false } = {}) {
  if (!Number.isFinite(value)) return `-- ${unit}`;
  if (value === 0) return `${signed ? '+0.000' : '0.000'} ${unit}`;

  const abs = Math.abs(value);
  const prefixes = [
    { p: 1e-12, s: 'p' },
    { p: 1e-9, s: 'n' },
    { p: 1e-6, s: 'µ' },
    { p: 1e-3, s: 'm' },
    { p: 1, s: '' },
    { p: 1e3, s: 'k' },
    { p: 1e6, s: 'M' },
    { p: 1e9, s: 'G' },
  ];

  let chosen = prefixes[4];
  for (const prefix of prefixes) {
    if (abs >= prefix.p) chosen = prefix;
  }

  const scaled = value / chosen.p;
  const sign = signed && scaled >= 0 ? '+' : '';
  return `${sign}${formatNumber(scaled, 3)} ${chosen.s}${unit}`;
}

function isDisabled(el) {
  return el instanceof HTMLButtonElement ? el.disabled : false;
}

export function createQuizController({
  statusEl,
  promptEl,
  answerInputEl,
  submitBtnEl,
  nextBtnEl,
  newQuizBtnEl,
  hintBtnEl,
  hintTextEl,
  feedbackEl,
  scoreEl,
  solutionsEl,
  questionCount = 5,
  onHintHighlight = null,
} = {}) {
  const state = {
    netlist: null,
    solution: null,
    seed: 'quiz',
    questions: [],
    index: 0,
    correct: 0,
    submittedCurrent: false,
    hintLevel: 0,
  };

  function updateText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  function answerSigned(question) {
    if (!question) return false;
    if (question.unit === 'V') return true;
    if (question.unit === 'A') return true;
    return false;
  }

  function renderSolutions() {
    if (!(solutionsEl instanceof HTMLElement)) return;

    const items = [];
    for (const q of state.questions) {
      const li = document.createElement('li');
      const answerText = formatSI(q.answer, q.unit, { signed: answerSigned(q) });
      const tolText = formatSI(q.tolerance, q.unit, { signed: false });
      li.textContent = `${q.prompt}  →  ${answerText} (±${tolText})`;
      items.push(li);
    }

    solutionsEl.replaceChildren(...items);
  }

  function setButtons({ canSubmit, canNext, canHint }) {
    if (submitBtnEl instanceof HTMLButtonElement) submitBtnEl.disabled = !canSubmit;
    if (nextBtnEl instanceof HTMLButtonElement) nextBtnEl.disabled = !canNext;
    if (hintBtnEl instanceof HTMLButtonElement) hintBtnEl.disabled = !canHint;
  }

  function currentQuestion() {
    return state.questions[state.index] ?? null;
  }

  function render() {
    const total = state.questions.length;
    const q = currentQuestion();

    updateText(scoreEl, `score: ${state.correct}/${total || questionCount}`);
    updateText(hintTextEl, '');
    state.hintLevel = 0;
    onHintHighlight?.({ nodes: [], components: [] });

    if (!q) {
      updateText(statusEl, total ? 'Quiz complete' : 'No quiz loaded');
      updateText(promptEl, total ? 'Generate a new quiz or a new circuit.' : '');
      setButtons({ canSubmit: false, canNext: false, canHint: false });
      if (answerInputEl instanceof HTMLInputElement) answerInputEl.value = '';
      return;
    }

    updateText(statusEl, `question ${state.index + 1}/${total}`);
    updateText(promptEl, q.prompt);

    const extra =
      q.kind === 'current' && q.meta?.direction ? `(${q.meta.direction})` : q.kind === 'voltage' ? '(red − black)' : '';
    updateText(feedbackEl, extra);

    if (answerInputEl instanceof HTMLInputElement) {
      answerInputEl.value = '';
      answerInputEl.placeholder = `answer in ${q.unit}`;
    }

    state.submittedCurrent = false;
    setButtons({ canSubmit: true, canNext: false, canHint: true });
  }

  function resetQuiz() {
    if (!state.netlist || !state.solution) return;
    state.questions = generateQuizQuestions({
      netlist: state.netlist,
      solution: state.solution,
      seed: state.seed,
      count: questionCount,
    });
    state.index = 0;
    state.correct = 0;
    state.submittedCurrent = false;
    state.hintLevel = 0;
    renderSolutions();
    render();
  }

  function setCircuit({ netlist, solution, seed } = {}) {
    state.netlist = netlist ?? null;
    state.solution = solution ?? null;
    state.seed = seed ?? 'quiz';
    resetQuiz();
  }

  function parseAnswer() {
    if (!(answerInputEl instanceof HTMLInputElement)) return { ok: false, value: NaN };
    const value = Number.parseFloat(answerInputEl.value);
    return { ok: Number.isFinite(value), value };
  }

  function submit() {
    if (state.submittedCurrent) return;
    const q = currentQuestion();
    if (!q) return;

    const parsed = parseAnswer();
    const result = gradeQuizAnswer(q, parsed.value);
    if (!result.ok) {
      updateText(feedbackEl, result.error ?? 'Invalid answer');
      return;
    }

    state.submittedCurrent = true;
    if (submitBtnEl instanceof HTMLButtonElement) submitBtnEl.disabled = true;
    if (nextBtnEl instanceof HTMLButtonElement) nextBtnEl.disabled = false;

    const correctText = formatSI(q.answer, q.unit, { signed: q.kind !== 'resistance' });
    if (result.correct) {
      state.correct += 1;
      updateText(feedbackEl, `Correct. ${correctText}`);
    } else {
      updateText(feedbackEl, `Incorrect. Correct: ${correctText}`);
    }

    updateText(scoreEl, `score: ${state.correct}/${state.questions.length}`);
  }

  function next() {
    if (!state.questions.length) return;
    if (isDisabled(nextBtnEl)) return;
    if (state.index >= state.questions.length - 1) {
      state.index = state.questions.length;
      updateText(statusEl, 'Quiz complete');
      updateText(promptEl, 'Generate a new quiz, or generate a new circuit.');
      setButtons({ canSubmit: false, canNext: false, canHint: false });
      updateText(hintTextEl, '');
      state.hintLevel = 0;
      onHintHighlight?.({ nodes: [], components: [] });
      return;
    }
    state.index += 1;
    render();
  }

  function hint() {
    const q = currentQuestion();
    if (!q || !state.netlist) return;

    const hints = getProgressiveHints({ question: q, netlist: state.netlist });
    const nextLevel = Math.min(3, state.hintLevel + 1);
    state.hintLevel = nextLevel;

    const h = hints[nextLevel - 1];
    if (!h) return;

    updateText(hintTextEl, `Hint ${nextLevel}/3 (${h.title}): ${h.text}`);
    onHintHighlight?.(h.highlight ?? { nodes: [], components: [] });
  }

  submitBtnEl?.addEventListener?.('click', () => submit());
  nextBtnEl?.addEventListener?.('click', () => next());
  newQuizBtnEl?.addEventListener?.('click', () => resetQuiz());
  hintBtnEl?.addEventListener?.('click', () => hint());
  answerInputEl?.addEventListener?.('keydown', (event) => {
    if (event.key !== 'Enter') return;
    if (!state.submittedCurrent) submit();
    else next();
  });

  return { setCircuit, resetQuiz };
}
