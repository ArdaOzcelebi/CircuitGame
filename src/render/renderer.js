import { layoutNetlist } from './layout.js';

const DEFAULT_THEME = {
  background: '#050610',
  wire: '#7df9ff',
  node: '#e6f7ff',
  label: '#c7d2fe',
  component: '#b7ffb7',
  componentText: '#06120d',
  current: '#ff4dff',
  warning: '#fbbf24',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function magnitudeToSpeed(currentAbs) {
  const ref = 0.01;
  const normalized = Math.sqrt(currentAbs / ref);
  return clamp(40 + 140 * normalized, 40, 260);
}

function magnitudeToSpacing(currentAbs) {
  const ref = 0.01;
  const normalized = Math.sqrt(currentAbs / ref);
  return clamp(30 - 18 * normalized, 10, 30);
}

function lineAngle(p1, p2) {
  return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

function drawNode(ctx, { x, y }, radius, theme) {
  ctx.fillStyle = theme.node;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawLabel(ctx, text, x, y, theme) {
  ctx.fillStyle = theme.label;
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawWire(ctx, p1, p2, theme) {
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
}

function drawResistor(ctx, p1, p2, id, theme) {
  const angle = lineAngle(p1, p2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;

  const boxLen = clamp(len * 0.25, 36, 70);
  const boxW = 16;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const sX = midX - (ux * boxLen) / 2;
  const sY = midY - (uy * boxLen) / 2;
  const eX = midX + (ux * boxLen) / 2;
  const eY = midY + (uy * boxLen) / 2;

  drawWire(ctx, p1, { x: sX, y: sY }, theme);
  drawWire(ctx, { x: eX, y: eY }, p2, theme);

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle);
  ctx.fillStyle = theme.component;
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(-boxLen / 2, -boxW / 2, boxLen, boxW);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.componentText;
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, 0, 0);
  ctx.restore();
}

function drawCircleSource(ctx, p1, p2, id, theme, { kind, arrow } = {}) {
  const angle = lineAngle(p1, p2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;

  const radius = 18;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  const sX = midX - ux * radius;
  const sY = midY - uy * radius;
  const eX = midX + ux * radius;
  const eY = midY + uy * radius;

  drawWire(ctx, p1, { x: sX, y: sY }, theme);
  drawWire(ctx, { x: eX, y: eY }, p2, theme);

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle);

  ctx.fillStyle = theme.component;
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.componentText;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, 0, -24);

  if (kind === 'voltage') {
    ctx.fillText('+', radius + 10, 0);
    ctx.fillText('−', -radius - 10, 0);
  }
  if (kind === 'current' && arrow) {
    ctx.strokeStyle = theme.componentText;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(3, -4);
    ctx.lineTo(3, 4);
    ctx.closePath();
    ctx.fillStyle = theme.componentText;
    ctx.fill();
  }

  ctx.restore();
}

function drawComponent(ctx, entry, theme) {
  const { component, p1, p2 } = entry;
  if (component.type === 'resistor') {
    drawResistor(ctx, p1, p2, component.id, theme);
  } else if (component.type === 'voltageSource') {
    drawCircleSource(ctx, p1, p2, component.id, theme, { kind: 'voltage' });
  } else if (component.type === 'currentSource') {
    drawCircleSource(ctx, p1, p2, component.id, theme, { kind: 'current', arrow: true });
  } else {
    drawWire(ctx, p1, p2, theme);
  }
}

function componentDirection(component) {
  switch (component.type) {
    case 'resistor':
      return { from: component.nodeA, to: component.nodeB };
    case 'voltageSource':
      return { from: component.positiveNode, to: component.negativeNode };
    case 'currentSource':
      return { from: component.fromNode, to: component.toNode };
    default:
      throw new Error(`Unknown component type: ${component.type}`);
  }
}

function drawCurrentDots(ctx, pFrom, pTo, current, t, theme) {
  const dx = pTo.x - pFrom.x;
  const dy = pTo.y - pFrom.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const currentAbs = Math.abs(current);
  const speed = magnitudeToSpeed(currentAbs);
  const spacing = magnitudeToSpacing(currentAbs);
  const offset = (t * speed) % spacing;

  const dotCount = Math.floor(len / spacing);
  ctx.fillStyle = theme.current;
  for (let i = 0; i <= dotCount; i += 1) {
    const dist = i * spacing + offset;
    if (dist < 0 || dist > len) continue;
    const x = pFrom.x + ux * dist;
    const y = pFrom.y + uy * dist;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function createCircuitRenderer(canvas, options = {}) {
  const theme = { ...DEFAULT_THEME, ...(options.theme ?? {}) };
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  let animationHandle = null;
  let frameStart = null;
  let state = null;

  function drawFrame(timestampMs) {
    if (!state) return;
    if (frameStart === null) frameStart = timestampMs;
    const t = (timestampMs - frameStart) / 1000;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw light wires first, then components, then nodes/labels, then current dots.
    for (const entry of state.layout.components) {
      drawWire(ctx, entry.p1, entry.p2, theme);
    }
    for (const entry of state.layout.components) {
      drawComponent(ctx, entry, theme);
    }

    for (const [nodeId, p] of state.layout.positions.entries()) {
      drawNode(ctx, p, state.layout.nodeRadius, theme);
      drawLabel(ctx, nodeId, p.x + 12, p.y, theme);
    }

    for (const entry of state.layout.components) {
      const { component } = entry;
      const current = state.solution.branchCurrents[component.id] ?? 0;
      if (!Number.isFinite(current) || Math.abs(current) < 1e-12) continue;

      const { from, to } = componentDirection(component);
      const currentPositive = current >= 0;
      const pFrom = currentPositive ? state.layout.positions.get(from) : state.layout.positions.get(to);
      const pTo = currentPositive ? state.layout.positions.get(to) : state.layout.positions.get(from);
      if (!pFrom || !pTo) continue;

      drawCurrentDots(ctx, pFrom, pTo, current, t, theme);
    }

    animationHandle = requestAnimationFrame(drawFrame);
  }

  function stop() {
    if (animationHandle !== null) {
      cancelAnimationFrame(animationHandle);
      animationHandle = null;
    }
    frameStart = null;
    state = null;
  }

  function render(netlist, solution, layoutOptions = {}) {
    stop();

    const width = layoutOptions.width ?? canvas.width;
    const height = layoutOptions.height ?? canvas.height;
    canvas.width = width;
    canvas.height = height;

    const layout = layoutNetlist(netlist, { width, height, ...layoutOptions });
    state = { layout, solution };
    animationHandle = requestAnimationFrame(drawFrame);
  }

  return { render, stop };
}

