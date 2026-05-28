import { measureVoltage, equivalentResistance } from '../engine/measure.js';
import { nearestComponent, nearestNode } from './hitTest.js';

const MODE = {
  V: 'V',
  A: 'A',
  R: 'R',
};

function clientToCanvas(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

function componentMidpoint(layout, componentId) {
  const entry = layout.components.find((e) => e.component.id === componentId);
  if (!entry) return null;
  return { x: (entry.p1.x + entry.p2.x) / 2, y: (entry.p1.y + entry.p2.y) / 2 };
}

function defaultProbeTargets(layout, netlist) {
  const nodes = [...netlist.nodes].sort();
  const ground = netlist.ground;
  const firstNonGround = nodes.find((n) => n !== ground) ?? ground;

  const blackPoint = layout.positions.get(ground) ?? { x: layout.margin, y: layout.height - layout.margin };
  const redPoint = layout.positions.get(firstNonGround) ?? { x: layout.width - layout.margin, y: layout.margin };

  return {
    red: { x: redPoint.x, y: redPoint.y, target: { kind: 'node', id: firstNonGround } },
    black: { x: blackPoint.x, y: blackPoint.y, target: { kind: 'node', id: ground } },
  };
}

function probeRadius() {
  return 16;
}

function isNearProbe(probe, point) {
  const dx = probe.x - point.x;
  const dy = probe.y - point.y;
  return Math.hypot(dx, dy) <= probeRadius() + 6;
}

function drawProbe(ctx, probe, { fill, stroke, label }) {
  ctx.save();
  ctx.shadowColor = fill;
  ctx.shadowBlur = 10;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(probe.x, probe.y, probeRadius(), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#050610';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, probe.x, probe.y);
  ctx.restore();
}

function drawTargetLink(ctx, probe, targetPoint, color) {
  if (!targetPoint) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(probe.x, probe.y);
  ctx.lineTo(targetPoint.x, targetPoint.y);
  ctx.stroke();
  ctx.restore();
}

function measurementText(state) {
  const { mode, netlist, solution, probes } = state;
  if (!netlist || !solution) return { value: '--', detail: '' };

  if (mode === MODE.V) {
    const red = probes.red.target?.kind === 'node' ? probes.red.target.id : null;
    const black = probes.black.target?.kind === 'node' ? probes.black.target.id : null;
    if (!red || !black) return { value: '-- V', detail: 'Place probes on two nodes' };
    const v = measureVoltage(solution, red, black);
    return { value: formatSI(v, 'V', { signed: true }), detail: `${red} − ${black}` };
  }

  if (mode === MODE.A) {
    const picked = probes.red.target?.kind === 'component' ? probes.red.target.id : state.hoverComponentId;
    if (!picked) return { value: '-- A', detail: 'Drag red probe onto a branch' };
    const current = solution.branchCurrents[picked];
    if (!Number.isFinite(current)) return { value: '-- A', detail: picked };
    return { value: formatSI(current, 'A', { signed: true }), detail: picked };
  }

  if (mode === MODE.R) {
    const red = probes.red.target?.kind === 'node' ? probes.red.target.id : null;
    const black = probes.black.target?.kind === 'node' ? probes.black.target.id : null;
    if (!red || !black) return { value: '-- Ω', detail: 'Place probes on two nodes' };
    const result = equivalentResistance(netlist, red, black);
    if (!result.ok || !Number.isFinite(result.resistanceOhms)) {
      return { value: 'Open', detail: result.error ?? `${red} − ${black}` };
    }
    return { value: formatSI(result.resistanceOhms, 'Ω'), detail: `${red} − ${black} (sources off)` };
  }

  return { value: '--', detail: '' };
}

export function createMultimeterController({
  overlayCanvas,
  readoutEl,
  detailEl,
  modeButtons = {},
} = {}) {
  if (!(overlayCanvas instanceof HTMLCanvasElement)) {
    throw new Error('overlayCanvas must be a canvas element');
  }
  const ctx = overlayCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const state = {
    mode: MODE.V,
    layout: null,
    netlist: null,
    solution: null,
    probes: {
      red: { x: 60, y: 60, target: null },
      black: { x: 80, y: 120, target: null },
    },
    dragging: null,
    hoverComponentId: null,
  };

  function updateModeButtons() {
    const buttonMap = { V: modeButtons.V, A: modeButtons.A, R: modeButtons.R };
    for (const [key, button] of Object.entries(buttonMap)) {
      if (!button) continue;
      const active = state.mode === key;
      button.dataset.active = active ? 'true' : 'false';
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function setMode(mode) {
    if (!Object.values(MODE).includes(mode)) return;
    state.mode = mode;
    state.hoverComponentId = null;
    if (mode !== MODE.A) {
      if (state.probes.red.target?.kind === 'component') state.probes.red.target = null;
      if (state.probes.black.target?.kind === 'component') state.probes.black.target = null;
    }
    updateModeButtons();
  }

  function setCircuit({ layout, netlist, solution }) {
    state.layout = layout;
    state.netlist = netlist;
    state.solution = solution;
    state.hoverComponentId = null;
    state.probes = defaultProbeTargets(layout, netlist);
  }

  function snapProbe(probe) {
    if (!state.layout || !state.netlist) return;

    const point = { x: probe.x, y: probe.y };
    const nodeHit = nearestNode(state.layout, point, 22);

    if (state.mode === MODE.A) {
      const componentHit = nearestComponent(state.layout, point, 16);
      if (componentHit) {
        const mid = componentMidpoint(state.layout, componentHit.component.id);
        if (mid) {
          probe.x = mid.x;
          probe.y = mid.y;
        }
        probe.target = { kind: 'component', id: componentHit.component.id };
        return;
      }
    }

    if (nodeHit) {
      probe.x = nodeHit.point.x;
      probe.y = nodeHit.point.y;
      probe.target = { kind: 'node', id: nodeHit.nodeId };
      return;
    }

    probe.target = null;
  }

  function currentHoveredComponent(point) {
    if (state.mode !== MODE.A || !state.layout) return null;
    const hit = nearestComponent(state.layout, point, 14);
    return hit?.component?.id ?? null;
  }

  function onPointerDown(event) {
    if (!state.layout) return;
    const point = clientToCanvas(overlayCanvas, event.clientX, event.clientY);

    const redNear = isNearProbe(state.probes.red, point);
    const blackNear = isNearProbe(state.probes.black, point);

    if (redNear && blackNear) {
      state.dragging = 'red';
    } else if (redNear) {
      state.dragging = 'red';
    } else if (blackNear) {
      state.dragging = 'black';
    } else {
      state.dragging = null;
    }

    if (state.dragging) {
      overlayCanvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    const point = clientToCanvas(overlayCanvas, event.clientX, event.clientY);

    if (state.dragging === 'red' || state.dragging === 'black') {
      const probe = state.dragging === 'red' ? state.probes.red : state.probes.black;
      probe.x = clamp(point.x, 0, overlayCanvas.width);
      probe.y = clamp(point.y, 0, overlayCanvas.height);
      probe.target = null;
      return;
    }

    state.hoverComponentId = currentHoveredComponent(point);
  }

  function onPointerUp(event) {
    if (state.dragging === 'red' || state.dragging === 'black') {
      const probe = state.dragging === 'red' ? state.probes.red : state.probes.black;
      snapProbe(probe);
      state.dragging = null;
      overlayCanvas.releasePointerCapture(event.pointerId);
      return;
    }
    state.dragging = null;
  }

  function targetPointForProbe(probe) {
    if (!state.layout) return null;
    if (probe.target?.kind === 'node') return state.layout.positions.get(probe.target.id) ?? null;
    if (probe.target?.kind === 'component') return componentMidpoint(state.layout, probe.target.id);
    return null;
  }

  function drawComponentHighlight(componentId, color) {
    if (!componentId || !state.layout) return;
    const entry = state.layout.components.find((e) => e.component.id === componentId);
    if (!entry) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(entry.p1.x, entry.p1.y);
    ctx.lineTo(entry.p2.x, entry.p2.y);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (state.mode === MODE.A) {
      const pinned = state.probes.red.target?.kind === 'component' ? state.probes.red.target.id : null;
      if (state.hoverComponentId && state.hoverComponentId !== pinned) {
        drawComponentHighlight(state.hoverComponentId, '#fbbf24');
      }
      if (pinned) {
        drawComponentHighlight(pinned, '#ff4dff');
      }
    }

    const redTarget = targetPointForProbe(state.probes.red);
    const blackTarget = targetPointForProbe(state.probes.black);
    drawTargetLink(ctx, state.probes.red, redTarget, '#ff4dff');
    drawTargetLink(ctx, state.probes.black, blackTarget, '#9ca3af');

    drawProbe(ctx, state.probes.black, { fill: '#e5e7eb', stroke: '#111827', label: 'B' });
    drawProbe(ctx, state.probes.red, { fill: '#ff4dff', stroke: '#2f0a2f', label: 'R' });

    const { value, detail } = measurementText(state);
    if (readoutEl) readoutEl.textContent = value;
    if (detailEl) detailEl.textContent = detail;

    requestAnimationFrame(draw);
  }

  overlayCanvas.addEventListener('pointerdown', onPointerDown);
  overlayCanvas.addEventListener('pointermove', onPointerMove);
  overlayCanvas.addEventListener('pointerup', onPointerUp);
  overlayCanvas.addEventListener('pointercancel', () => {
    state.dragging = null;
  });

  updateModeButtons();
  requestAnimationFrame(draw);

  return { setMode, setCircuit };
}

