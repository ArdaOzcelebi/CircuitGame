import { generateCircuit } from './engine/generator.js';
import { createCircuitRenderer } from './render/renderer.js';
import { layoutNetlist } from './render/layout.js';
import { createMultimeterController } from './ui/multimeter.js';
import { createQuizController } from './ui/quiz.js';
import { createManualController } from './ui/manual.js';

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
const toggleLabels = document.getElementById('toggleLabels');
const toggleValues = document.getElementById('toggleValues');
const quizStatus = document.getElementById('quizStatus');
const quizPrompt = document.getElementById('quizPrompt');
const quizAnswer = document.getElementById('quizAnswer');
const quizSubmit = document.getElementById('quizSubmit');
const quizNext = document.getElementById('quizNext');
const newQuizBtn = document.getElementById('newQuizBtn');
const quizHint = document.getElementById('quizHint');
const quizHintText = document.getElementById('quizHintText');
const quizFeedback = document.getElementById('quizFeedback');
const quizScore = document.getElementById('quizScore');
const quizSolutions = document.getElementById('quizSolutions');
const manualPanel = document.getElementById('manualPanel');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing <canvas id="schematic">');
}
if (!(overlay instanceof HTMLCanvasElement)) {
  throw new Error('Missing <canvas id="schematicOverlay">');
}

const viewport = { scale: 1, offsetX: 0, offsetY: 0 };

const renderer = createCircuitRenderer(canvas);
renderer.setView(viewport);

const multimeter = createMultimeterController({
  overlayCanvas: overlay,
  readoutEl: meterReadout,
  detailEl: meterDetail,
  modeButtons: { V: modeV, A: modeA, R: modeR },
  viewport,
  onViewportChange: (next) => {
    viewport.scale = next.scale;
    viewport.offsetX = next.offsetX;
    viewport.offsetY = next.offsetY;
    renderer.setView(viewport);
  },
});

const quiz = createQuizController({
  statusEl: quizStatus,
  promptEl: quizPrompt,
  answerInputEl: quizAnswer,
  submitBtnEl: quizSubmit,
  nextBtnEl: quizNext,
  newQuizBtnEl: newQuizBtn,
  hintBtnEl: quizHint,
  hintTextEl: quizHintText,
  feedbackEl: quizFeedback,
  scoreEl: quizScore,
  solutionsEl: quizSolutions,
  onHintHighlight: (highlight) => multimeter.setHintHighlight(highlight),
});

const manual = createManualController({ containerEl: manualPanel });

function formatMeta(meta) {
  const hasSeed = meta.seed !== undefined && meta.seed !== null;
  return [
    `nodes: ${meta.nodeCount}`,
    `components: ${meta.componentCount}`,
    `loops: ${meta.loopCount}`,
    `difficulty: ${meta.difficulty ?? 'legacy'}`,
    hasSeed ? `seed: ${meta.seed}` : 'seed: (random)',
  ].join('\n');
}

function renderNewCircuit() {
  try {
    if (newCircuitBtn instanceof HTMLButtonElement) newCircuitBtn.disabled = true;

    const seed = seedInput?.value?.trim() || undefined;
    const difficulty =
      difficultySelect instanceof HTMLSelectElement && difficultySelect.value ? difficultySelect.value : undefined;
    const { netlist, solution, meta } = generateCircuit({ seed, difficulty });

    if (info) info.textContent = formatMeta(meta);

    const width = 1000;
    const height = 650;
    const layout = layoutNetlist(netlist, { width, height });

    viewport.scale = 1;
    viewport.offsetX = 0;
    viewport.offsetY = 0;
    renderer.setView(viewport);
    multimeter.setViewport(viewport);

    overlay.width = width;
    overlay.height = height;
    renderer.render(netlist, solution, { width, height, layout });
    multimeter.setCircuit({ layout, netlist, solution });
    const quizSeed = meta.seed !== undefined && meta.seed !== null ? String(meta.seed) : (seed ?? `${Date.now()}`);
    quiz.setCircuit({ netlist, solution, seed: quizSeed });
    manual.setCircuit({ netlist, solution });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (info) info.textContent = `Error generating circuit:\n${message}\n\nTry again (or pick a different seed/difficulty).`;
    // Don't throw: keep the UI responsive even if a generation attempt fails.
  } finally {
    if (newCircuitBtn instanceof HTMLButtonElement) newCircuitBtn.disabled = false;
  }
}

newCircuitBtn?.addEventListener('click', () => renderNewCircuit());
seedInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') renderNewCircuit();
});
difficultySelect?.addEventListener('change', () => renderNewCircuit());

modeV?.addEventListener('click', () => multimeter.setMode('V'));
modeA?.addEventListener('click', () => multimeter.setMode('A'));
modeR?.addEventListener('click', () => multimeter.setMode('R'));

function updateDisplay() {
  const showNodeLabels =
    !(toggleLabels instanceof HTMLInputElement) || toggleLabels.checked === undefined ? true : toggleLabels.checked;
  const showComponentValues =
    !(toggleValues instanceof HTMLInputElement) || toggleValues.checked === undefined ? true : toggleValues.checked;
  renderer.setDisplay({ showNodeLabels, showComponentValues });
}

toggleLabels?.addEventListener?.('change', () => updateDisplay());
toggleValues?.addEventListener?.('change', () => updateDisplay());

updateDisplay();
renderNewCircuit();
