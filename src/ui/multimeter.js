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

function canvasToWorld(view, point) {
  const scale = view?.scale ?? 1;
  const offsetX = view?.offsetX ?? 0;
  const offsetY = view?.offsetY ?? 0;
  return {
    x: (point.x - offsetX) / scale,
    y: (point.y - offsetY) / scale,
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

function probeRadiusWorld(view) {
  const scale = view?.scale ?? 1;
  return probeRadius() / Math.max(0.1, scale);
}

function isNearProbe(view, probe, point) {
  const dx = probe.x - point.x;
  const dy = probe.y - point.y;
  return Math.hypot(dx, dy) <= probeRadiusWorld(view) + 6 / Math.max(0.1, view?.scale ?? 1);
}

function drawProbe(ctx, view, probe, { fill, stroke, label, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = fill;
  ctx.shadowBlur = 10;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(probe.x, probe.y, probeRadiusWorld(view), 0, Math.PI * 2);
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
  viewport = { scale: 1, offsetX: 0, offsetY: 0 },
  onViewportChange = null,
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
    ghost: null,
    view: { ...viewport },
    pan: null,
    hintHighlight: { nodes: new Set(), components: new Set() },
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
    state.ghost = null;
    state.hintHighlight = { nodes: new Set(), components: new Set() };
  }

  function snapProbe(probe, { snapScreenPx = 22 } = {}) {
    if (!state.layout || !state.netlist) return;

    const point = { x: probe.x, y: probe.y };
    const snapWorld = snapScreenPx / Math.max(0.1, state.view.scale);
    const nodeHit = nearestNode(state.layout, point, snapWorld);

    if (state.mode === MODE.A) {
      const componentHit = nearestComponent(state.layout, point, 16 / Math.max(0.1, state.view.scale));
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

  function magneticSnapProbe(probe) {
    snapProbe(probe, { snapScreenPx: 14 });
  }

  function currentHoveredComponent(point) {
    if (state.mode !== MODE.A || !state.layout) return null;
    const hit = nearestComponent(state.layout, point, 14 / Math.max(0.1, state.view.scale));
    return hit?.component?.id ?? null;
  }

  function onPointerDown(event) {
    if (!state.layout) return;
    const canvasPoint = clientToCanvas(overlayCanvas, event.clientX, event.clientY);
    const point = canvasToWorld(state.view, canvasPoint);

    const redNear = isNearProbe(state.view, state.probes.red, point);
    const blackNear = isNearProbe(state.view, state.probes.black, point);

    if (redNear && blackNear) {
      state.dragging = 'red';
    } else if (redNear) {
      state.dragging = 'red';
    } else if (blackNear) {
      state.dragging = 'black';
    } else {
      state.dragging = 'pan';
      state.pan = { startCanvas: canvasPoint, startView: { ...state.view } };
    }

    if (state.dragging) {
      overlayCanvas.setPointerCapture(event.pointerId);
      event.preventDefault();
    }
  }

  function onPointerMove(event) {
    const canvasPoint = clientToCanvas(overlayCanvas, event.clientX, event.clientY);
    const point = canvasToWorld(state.view, canvasPoint);

    if (state.dragging === 'red' || state.dragging === 'black') {
      const probe = state.dragging === 'red' ? state.probes.red : state.probes.black;
      probe.x = clamp(point.x, 0, state.layout?.width ?? overlayCanvas.width);
      probe.y = clamp(point.y, 0, state.layout?.height ?? overlayCanvas.height);
      probe.target = null;
      magneticSnapProbe(probe);
      return;
    }

    if (state.dragging === 'pan' && state.pan) {
      const dx = canvasPoint.x - state.pan.startCanvas.x;
      const dy = canvasPoint.y - state.pan.startCanvas.y;
      state.view.offsetX = state.pan.startView.offsetX + dx;
      state.view.offsetY = state.pan.startView.offsetY + dy;
      onViewportChange?.({ ...state.view });
      return;
    }

    state.hoverComponentId = currentHoveredComponent(point);
  }

  function onPointerUp(event) {
    if (state.dragging === 'red' || state.dragging === 'black') {
      const probe = state.dragging === 'red' ? state.probes.red : state.probes.black;
      snapProbe(probe);
      state.dragging = null;
      state.pan = null;
      overlayCanvas.releasePointerCapture(event.pointerId);
      return;
    }
    state.dragging = null;
    state.pan = null;
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

  function drawNodeHighlight(nodeId, color) {
    if (!nodeId || !state.layout) return;
    const p = state.layout.positions.get(nodeId);
    if (!p) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 / Math.max(0.1, state.view.scale);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(p.x, p.y, (state.layout.nodeRadius + 14) / Math.max(0.1, state.view.scale), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    ctx.setTransform(state.view.scale, 0, 0, state.view.scale, state.view.offsetX, state.view.offsetY);

    for (const componentId of state.hintHighlight.components) {
      drawComponentHighlight(componentId, '#60a5fa');
    }
    for (const nodeId of state.hintHighlight.nodes) {
      drawNodeHighlight(nodeId, '#60a5fa');
    }

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

    if (state.ghost) {
      drawProbe(ctx, state.view, state.ghost.black, { fill: '#e5e7eb', stroke: '#111827', label: 'B', alpha: 0.25 });
      drawProbe(ctx, state.view, state.ghost.red, { fill: '#ff4dff', stroke: '#2f0a2f', label: 'R', alpha: 0.25 });
    }

    drawProbe(ctx, state.view, state.probes.black, { fill: '#e5e7eb', stroke: '#111827', label: 'B' });
    drawProbe(ctx, state.view, state.probes.red, { fill: '#ff4dff', stroke: '#2f0a2f', label: 'R' });

    const { value, detail } = measurementText(state);
    if (readoutEl) readoutEl.textContent = value;
    if (detailEl) detailEl.textContent = detail;

    requestAnimationFrame(draw);
  }

  function onWheel(event) {
    if (!state.layout) return;
    event.preventDefault();

    const canvasPoint = clientToCanvas(overlayCanvas, event.clientX, event.clientY);
    const worldPoint = canvasToWorld(state.view, canvasPoint);

    const zoomIn = event.deltaY < 0;
    const factor = zoomIn ? 1.12 : 1 / 1.12;
    const nextScale = clamp(state.view.scale * factor, 0.5, 3.0);

    state.view.scale = nextScale;
    state.view.offsetX = canvasPoint.x - worldPoint.x * nextScale;
    state.view.offsetY = canvasPoint.y - worldPoint.y * nextScale;
    onViewportChange?.({ ...state.view });
  }

  function resetProbes() {
    if (!state.layout || !state.netlist) return;
    state.ghost = {
      red: { ...state.probes.red },
      black: { ...state.probes.black },
    };
    state.probes = defaultProbeTargets(state.layout, state.netlist);
  }

  function onKeyDown(event) {
    const tag = event.target instanceof HTMLElement ? event.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key.toLowerCase() === 'r') {
      resetProbes();
    }
  }

  overlayCanvas.addEventListener('pointerdown', onPointerDown);
  overlayCanvas.addEventListener('pointermove', onPointerMove);
  overlayCanvas.addEventListener('pointerup', onPointerUp);
  overlayCanvas.addEventListener('pointercancel', () => {
    state.dragging = null;
    state.pan = null;
  });
  overlayCanvas.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('keydown', onKeyDown);

  updateModeButtons();
  requestAnimationFrame(draw);

  function setViewport(nextViewport) {
    if (!nextViewport) return;
    if (Number.isFinite(nextViewport.scale)) state.view.scale = nextViewport.scale;
    if (Number.isFinite(nextViewport.offsetX)) state.view.offsetX = nextViewport.offsetX;
    if (Number.isFinite(nextViewport.offsetY)) state.view.offsetY = nextViewport.offsetY;
  }

  function setHintHighlight({ nodes = [], components = [] } = {}) {
    state.hintHighlight = { nodes: new Set(nodes), components: new Set(components) };
  }

  return { setMode, setCircuit, setViewport, resetProbes, setHintHighlight };
}
