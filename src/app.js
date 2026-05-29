import { generateCircuit } from './engine/generator.js';
import { createCircuitRenderer } from './render/renderer.js';
import { layoutNetlist } from './render/layout.js';
import { createMultimeterController } from './ui/multimeter.js';
import { createQuizController } from './ui/quiz.js';

const canvas = document.getElementById('schematic');
const overlay = document.getElementById('schematicOverlay');
const info = document.getElementById('info');
const newCircuitBtn = document.getElementById('newCircuitBtn');
const seedInput = document.getElementById('seedInput');
const difficultySelect = document.getElementById('difficultySelect');
const meterReadout = document.getElementById('meterReadout');
const meterDetail = document.getElementById('meterDetail');
const modeV = document.getElementById('modeV');
const modeA = document.getElementById('modeA');
const modeR = document.getElementById('modeR');
const quizStatus = document.getElementById('quizStatus');
const quizPrompt = document.getElementById('quizPrompt');
const quizAnswer = document.getElementById('quizAnswer');
const quizSubmit = document.getElementById('quizSubmit');
const quizNext = document.getElementById('quizNext');
const newQuizBtn = document.getElementById('newQuizBtn');
const quizFeedback = document.getElementById('quizFeedback');
const quizScore = document.getElementById('quizScore');
const quizSolutions = document.getElementById('quizSolutions');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing <canvas id="schematic">');
}
if (!(overlay instanceof HTMLCanvasElement)) {
  throw new Error('Missing <canvas id="schematicOverlay">');
}

const renderer = createCircuitRenderer(canvas);
const multimeter = createMultimeterController({
  overlayCanvas: overlay,
  readoutEl: meterReadout,
  detailEl: meterDetail,
  modeButtons: { V: modeV, A: modeA, R: modeR },
});

const quiz = createQuizController({
  statusEl: quizStatus,
  promptEl: quizPrompt,
  answerInputEl: quizAnswer,
  submitBtnEl: quizSubmit,
  nextBtnEl: quizNext,
  newQuizBtnEl: newQuizBtn,
  feedbackEl: quizFeedback,
  scoreEl: quizScore,
  solutionsEl: quizSolutions,
});

function formatMeta(meta) {
  return [
    `nodes: ${meta.nodeCount}`,
    `components: ${meta.componentCount}`,
    `loops: ${meta.loopCount}`,
    `difficulty: ${meta.difficulty ?? 'legacy'}`,
    meta.seed ? `seed: ${meta.seed}` : 'seed: (random)',
  ].join('\n');
}

function renderNewCircuit() {
  const seed = seedInput?.value?.trim() || undefined;
  const difficulty =
    difficultySelect instanceof HTMLSelectElement && difficultySelect.value ? difficultySelect.value : undefined;
  const { netlist, solution, meta } = generateCircuit({ seed, difficulty });

  if (info) info.textContent = formatMeta(meta);

  const width = 1000;
  const height = 650;
  const layout = layoutNetlist(netlist, { width, height });

  overlay.width = width;
  overlay.height = height;
  renderer.render(netlist, solution, { width, height, layout });
  multimeter.setCircuit({ layout, netlist, solution });
  quiz.setCircuit({ netlist, solution, seed: seed ?? `${Date.now()}` });
}

newCircuitBtn?.addEventListener('click', () => renderNewCircuit());
seedInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') renderNewCircuit();
});
difficultySelect?.addEventListener('change', () => renderNewCircuit());

modeV?.addEventListener('click', () => multimeter.setMode('V'));
modeA?.addEventListener('click', () => multimeter.setMode('A'));
modeR?.addEventListener('click', () => multimeter.setMode('R'));

renderNewCircuit();
