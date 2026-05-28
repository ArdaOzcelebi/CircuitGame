import test from 'node:test';
import assert from 'node:assert/strict';
import { Netlist, solveMNA } from '../src/engine/circuit.js';
import { renderSchematicSvg } from '../src/renderer/schematic.js';

const extractComponentBlock = (svg, componentId) => {
  const regex = new RegExp(`data-component-id="${componentId}"[\\s\\S]*?<\\/g>`, 'm');
  return svg.match(regex)?.[0] ?? '';
};

test('renders animated SVG with current direction cues', () => {
  const circuit = new Netlist({ ground: '0' })
    .addVoltageSource('V1', 'n1', '0', 12)
    .addResistor('R1', 'n1', 'n2', 2000)
    .addResistor('R2', 'n2', '0', 1000);

  const solution = solveMNA(circuit);
  const { svg } = renderSchematicSvg(circuit, solution, { width: 420, height: 300 });

  assert.match(svg, /<svg/);
  assert.match(svg, /current-flow/);
  assert.match(svg, /animation-direction:normal/);
  assert.match(svg, /animation-direction:reverse/);
});

test('maps negative branch current to reverse animation', () => {
  const circuit = new Netlist({ ground: '0' })
    .addResistor('R1', 'n1', '0', 1000)
    .addCurrentSource('I1', 'n1', '0', 0.002);

  const solution = solveMNA(circuit);
  const { svg } = renderSchematicSvg(circuit, solution);

  const resistorBlock = extractComponentBlock(svg, 'R1');
  assert.ok(resistorBlock.length > 0);
  assert.match(resistorBlock, /animation-direction:reverse/);
});
