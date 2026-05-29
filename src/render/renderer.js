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

function drawDiode(ctx, p1, p2, id, theme, { kind } = {}) {
  const angle = lineAngle(p1, p2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const symbolLen = clamp(len * 0.22, 30, 60);
  const w = 18;

  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const start = { x: midX - (ux * symbolLen) / 2, y: midY - (uy * symbolLen) / 2 };
  const end = { x: midX + (ux * symbolLen) / 2, y: midY + (uy * symbolLen) / 2 };

  drawWire(ctx, p1, start, theme);
  drawWire(ctx, end, p2, theme);

  ctx.save();
  ctx.translate(midX, midY);
  ctx.rotate(angle);

  ctx.fillStyle = theme.component;
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;

  // Triangle points toward cathode (end).
  ctx.beginPath();
  ctx.moveTo(-symbolLen / 2, -w / 2);
  ctx.lineTo(-symbolLen / 2, w / 2);
  ctx.lineTo(symbolLen / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cathode line.
  ctx.beginPath();
  ctx.moveTo(symbolLen / 2, -w / 2);
  ctx.lineTo(symbolLen / 2, w / 2);
  ctx.stroke();

  if (kind === 'zener') {
    // Bent cathode to hint zener behavior.
    ctx.beginPath();
    ctx.moveTo(symbolLen / 2, -w / 2);
    ctx.lineTo(symbolLen / 2 + 7, -w / 2 - 6);
    ctx.moveTo(symbolLen / 2, w / 2);
    ctx.lineTo(symbolLen / 2 + 7, w / 2 + 6);
    ctx.stroke();
  }

  ctx.fillStyle = theme.componentText;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, 0, -26);

  ctx.restore();

  // Add a subtle direction mark to help learners.
  ctx.save();
  ctx.strokeStyle = theme.label;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(midX + px * 10, midY + py * 10);
  ctx.lineTo(midX + px * 18, midY + py * 18);
  ctx.stroke();
  ctx.restore();
}

function drawBjt(ctx, entry, theme, layout) {
  const { component, p1, p2 } = entry;
  const basePoint = layout.positions.get(component.baseNode);
  const angle = lineAngle(p1, p2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const bodyOffset = 20;
  const body = { x: mid.x + px * bodyOffset, y: mid.y + py * bodyOffset };

  drawWire(ctx, p1, mid, theme);
  drawWire(ctx, mid, p2, theme);
  if (basePoint) drawWire(ctx, basePoint, body, theme);

  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(angle);

  ctx.fillStyle = theme.component;
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.componentText;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(component.id, 0, 0);
  ctx.restore();

  // Emitter arrow: NPN points out, PNP points in.
  const emitterDir = component.type === 'bjtPnp' ? -1 : 1;
  const arrowBase = { x: body.x + ux * 8, y: body.y + uy * 8 };
  const arrowTip = { x: arrowBase.x + ux * 14 * emitterDir, y: arrowBase.y + uy * 14 * emitterDir };
  ctx.save();
  ctx.strokeStyle = theme.componentText;
  ctx.fillStyle = theme.componentText;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(arrowBase.x, arrowBase.y);
  ctx.lineTo(arrowTip.x, arrowTip.y);
  ctx.stroke();
  const perp = { x: -uy, y: ux };
  ctx.beginPath();
  ctx.moveTo(arrowTip.x, arrowTip.y);
  ctx.lineTo(arrowTip.x - ux * 6 * emitterDir + perp.x * 4, arrowTip.y - uy * 6 * emitterDir + perp.y * 4);
  ctx.lineTo(arrowTip.x - ux * 6 * emitterDir - perp.x * 4, arrowTip.y - uy * 6 * emitterDir - perp.y * 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMosfet(ctx, entry, theme, layout) {
  const { component, p1, p2 } = entry;
  const gatePoint = layout.positions.get(component.gateNode);
  const angle = lineAngle(p1, p2);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const bodyOffset = 22;
  const body = { x: mid.x + px * bodyOffset, y: mid.y + py * bodyOffset };

  drawWire(ctx, p1, mid, theme);
  drawWire(ctx, mid, p2, theme);
  if (gatePoint) drawWire(ctx, gatePoint, body, theme);

  ctx.save();
  ctx.translate(body.x, body.y);
  ctx.rotate(angle);

  ctx.fillStyle = theme.component;
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.rect(-18, -14, 36, 28);
  ctx.fill();
  ctx.stroke();

  // Channel line.
  ctx.strokeStyle = theme.componentText;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(-6, 10);
  ctx.stroke();

  ctx.fillStyle = theme.componentText;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(component.id, 8, 0);

  // Polarity hint.
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.fillText(component.type === 'mosfetP' ? 'P' : 'N', -12, 0);

  ctx.restore();
}

function drawOpAmp(ctx, entry, theme, layout) {
  const { component, p1, p2 } = entry;
  const outPoint = layout.positions.get(component.outputNode) ?? p1;
  const refPoint = layout.positions.get(component.referenceNode) ?? p2;
  const nonInv = layout.positions.get(component.nonInvertingNode);
  const inv = layout.positions.get(component.invertingNode);

  const dx = outPoint.x - refPoint.x;
  const dy = outPoint.y - refPoint.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const tip = outPoint;
  const baseCenter = { x: tip.x - ux * 70, y: tip.y - uy * 70 };
  const halfW = 32;
  const left = { x: baseCenter.x + px * halfW, y: baseCenter.y + py * halfW };
  const right = { x: baseCenter.x - px * halfW, y: baseCenter.y - py * halfW };

  // Lead wires.
  if (nonInv) drawWire(ctx, nonInv, left, theme);
  if (inv) drawWire(ctx, inv, right, theme);
  drawWire(ctx, tip, refPoint, theme);

  // Body.
  ctx.save();
  ctx.fillStyle = theme.component;
  ctx.strokeStyle = theme.wire;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  const center = { x: (left.x + right.x + tip.x) / 3, y: (left.y + right.y + tip.y) / 3 };
  ctx.fillStyle = theme.componentText;
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(component.id, center.x, center.y);

  // + and − markers near input pins.
  if (nonInv && inv) {
    const dLeft = Math.hypot(nonInv.x - left.x, nonInv.y - left.y);
    const dRight = Math.hypot(nonInv.x - right.x, nonInv.y - right.y);
    const plusPoint = dLeft <= dRight ? left : right;
    const minusPoint = plusPoint === left ? right : left;
    ctx.fillText('+', plusPoint.x + ux * 6, plusPoint.y + uy * 6);
    ctx.fillText('−', minusPoint.x + ux * 6, minusPoint.y + uy * 6);
  }

  ctx.restore();
}

function drawComponent(ctx, entry, theme, layout) {
  const { component, p1, p2 } = entry;
  if (component.type === 'resistor') {
    drawResistor(ctx, p1, p2, component.id, theme);
  } else if (component.type === 'voltageSource') {
    drawCircleSource(ctx, p1, p2, component.id, theme, { kind: 'voltage' });
  } else if (component.type === 'currentSource') {
    drawCircleSource(ctx, p1, p2, component.id, theme, { kind: 'current', arrow: true });
  } else if (component.type === 'diode') {
    drawDiode(ctx, p1, p2, component.id, theme);
  } else if (component.type === 'zenerDiode') {
    drawDiode(ctx, p1, p2, component.id, theme, { kind: 'zener' });
  } else if (component.type === 'idealOpAmp') {
    drawOpAmp(ctx, entry, theme, layout);
  } else if (component.type === 'bjtNpn' || component.type === 'bjtPnp') {
    drawBjt(ctx, entry, theme, layout);
  } else if (component.type === 'mosfetN' || component.type === 'mosfetP') {
    drawMosfet(ctx, entry, theme, layout);
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
    case 'diode':
      return { from: component.anodeNode, to: component.cathodeNode };
    case 'zenerDiode':
      return { from: component.anodeNode, to: component.cathodeNode };
    case 'idealOpAmp':
      return { from: component.outputNode, to: component.referenceNode };
    case 'bjtNpn':
    case 'bjtPnp':
      return { from: component.collectorNode, to: component.emitterNode };
    case 'mosfetN':
    case 'mosfetP':
      return { from: component.drainNode, to: component.sourceNode };
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
      drawComponent(ctx, entry, theme, state.layout);
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

    const { layout: providedLayout, ...otherLayoutOptions } = layoutOptions;
    const layout = providedLayout ?? layoutNetlist(netlist, { width, height, ...otherLayoutOptions });
    state = { layout, solution };
    animationHandle = requestAnimationFrame(drawFrame);
  }

  return { render, stop };
}
