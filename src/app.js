import { generateCircuit } from './engine/generator.js';
import { createCircuitRenderer } from './render/renderer.js';
import { layoutNetlist } from './render/layout.js';
import { createMultimeterController } from './ui/multimeter.js';

const canvas = document.getElementById('schematic');
const overlay = document.getElementById('schematicOverlay');
const info = document.getElementById('info');
const newCircuitBtn = document.getElementById('newCircuitBtn');
const seedInput = document.getElementById('seedInput');
const meterReadout = document.getElementById('meterReadout');
const meterDetail = document.getElementById('meterDetail');
const modeV = document.getElementById('modeV');
const modeA = document.getElementById('modeA');
const modeR = document.getElementById('modeR');

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

function formatMeta(meta) {
  return [
    `nodes: ${meta.nodeCount}`,
    `components: ${meta.componentCount}`,
    `loops: ${meta.loopCount}`,
    meta.seed ? `seed: ${meta.seed}` : 'seed: (random)',
  ].join('\n');
}

function renderNewCircuit() {
  const seed = seedInput?.value?.trim() || undefined;
  const { netlist, solution, meta } = generateCircuit({ seed });

  if (info) info.textContent = formatMeta(meta);

  const width = 1000;
  const height = 650;
  const layout = layoutNetlist(netlist, { width, height });

  overlay.width = width;
  overlay.height = height;
  renderer.render(netlist, solution, { width, height, layout });
  multimeter.setCircuit({ layout, netlist, solution });
}

newCircuitBtn?.addEventListener('click', () => renderNewCircuit());
seedInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') renderNewCircuit();
});

modeV?.addEventListener('click', () => multimeter.setMode('V'));
modeA?.addEventListener('click', () => multimeter.setMode('A'));
modeR?.addEventListener('click', () => multimeter.setMode('R'));

renderNewCircuit();
