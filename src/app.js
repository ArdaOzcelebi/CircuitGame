import { generateCircuit } from './engine/generator.js';
import { createCircuitRenderer } from './render/renderer.js';

const canvas = document.getElementById('schematic');
const info = document.getElementById('info');
const newCircuitBtn = document.getElementById('newCircuitBtn');
const seedInput = document.getElementById('seedInput');

if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing <canvas id="schematic">');
}

const renderer = createCircuitRenderer(canvas);

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
  renderer.render(netlist, solution, { width: 1000, height: 650 });
}

newCircuitBtn?.addEventListener('click', () => renderNewCircuit());
seedInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') renderNewCircuit();
});

renderNewCircuit();

