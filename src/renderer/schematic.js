const DEFAULT_THEME = {
  background: '#0b0f1a',
  wire: '#2f3b56',
  component: '#69f0ff',
  node: '#f8fbff',
  label: '#b6c7ff',
  current: '#00e5ff',
};

const DEFAULT_FLOW = {
  referenceCurrent: 0.01,
  minDuration: 0.6,
  maxDuration: 3.2,
  minOpacity: 0.2,
};

const DEFAULT_LAYOUT = {
  width: 800,
  height: 520,
  padding: 72,
  nodeRadius: 5,
  labelOffset: 14,
  componentLabelOffset: 18,
};

export function layoutNetlist(netlist, options = {}) {
  const { width, height, padding } = { ...DEFAULT_LAYOUT, ...options };
  const ground = netlist.ground;
  const nodeList = [...netlist.nodes].filter((node) => node !== ground);
  const positions = new Map();

  if (nodeList.length === 0) {
    positions.set(ground, { x: width / 2, y: height / 2 });
    return { width, height, positions };
  }

  const center = { x: width / 2, y: height / 2 - padding / 3 };
  const radius = Math.max(40, Math.min(width, height) / 2 - padding);

  nodeList.forEach((nodeId, index) => {
    const angle = (2 * Math.PI * index) / nodeList.length - Math.PI / 2;
    positions.set(nodeId, {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  });

  positions.set(ground, { x: width / 2, y: height - padding });

  return { width, height, positions };
}

export function renderSchematicSvg(netlist, solution = {}, options = {}) {
  const theme = { ...DEFAULT_THEME, ...(options.theme ?? {}) };
  const flow = { ...DEFAULT_FLOW, ...(options.flow ?? {}) };
  const layout = layoutNetlist(netlist, options);
  const { width, height, positions } = layout;
  const branchCurrents = solution.branchCurrents ?? {};

  const componentMarkup = netlist.components
    .map((component) => {
      const { fromNode, toNode } = getComponentOrientation(component);
      const start = positions.get(fromNode);
      const end = positions.get(toNode);
      if (!start || !end) {
        return '';
      }
      const current = branchCurrents[component.id] ?? 0;
      return renderComponent(component, start, end, current, theme, flow, options);
    })
    .join('');

  const nodeMarkup = [...positions.entries()]
    .map(([nodeId, point]) => renderNode(nodeId, netlist.ground, point, theme, options))
    .join('');

  const style = `
    .schematic-root { font-family: "Inter", "Segoe UI", sans-serif; }
    .wire { stroke: ${theme.wire}; stroke-width: 2; }
    .component-symbol { stroke: ${theme.component}; fill: ${theme.background}; stroke-width: 2; }
    .component-label { fill: ${theme.label}; font-size: 12px; font-weight: 600; }
    .node { fill: ${theme.node}; }
    .node-label { fill: ${theme.label}; font-size: 11px; }
    .current-flow {
      stroke: ${theme.current};
      stroke-width: 2;
      stroke-dasharray: 6 6;
      animation: current-flow linear infinite;
    }
    @keyframes current-flow {
      from { stroke-dashoffset: 0; }
      to { stroke-dashoffset: -12; }
    }
  `;

  const svg = `
    <svg class="schematic-root" xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <style><![CDATA[${style}]]></style>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="${theme.component}" />
        </marker>
      </defs>
      <rect width="100%" height="100%" fill="${theme.background}" />
      ${componentMarkup}
      ${nodeMarkup}
    </svg>
  `;

  return { svg: svg.trim(), layout };
}

function renderComponent(component, start, end, current, theme, flow, options) {
  const { componentLabelOffset = DEFAULT_LAYOUT.componentLabelOffset } = options;
  const mid = midpoint(start, end);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
  const normal = { x: -(end.y - start.y) / length, y: (end.x - start.x) / length };
  const labelPoint = {
    x: mid.x + normal.x * componentLabelOffset,
    y: mid.y + normal.y * componentLabelOffset,
  };

  const flowStyle = currentFlowStyle(current, flow);
  const flowLine = `
    <line class="current-flow" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"
      style="animation-duration:${flowStyle.duration}s;animation-direction:${flowStyle.direction};opacity:${flowStyle.opacity};" />
  `;

  return `
    <g class="component" data-component-id="${component.id}" data-component-type="${component.type}">
      <line class="wire" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" />
      ${flowLine}
      ${renderSymbol(component, mid, angle, theme)}
      <text class="component-label" x="${labelPoint.x}" y="${labelPoint.y}">${component.id}</text>
    </g>
  `;
}

function renderSymbol(component, mid, angle, theme) {
  const rotate = (angle * 180) / Math.PI;
  if (component.type === 'resistor') {
    return `
      <rect class="component-symbol" x="${mid.x - 14}" y="${mid.y - 6}" width="28" height="12"
        transform="rotate(${rotate} ${mid.x} ${mid.y})" rx="2" />
    `;
  }

  if (component.type === 'voltageSource') {
    const dx = Math.cos(angle) * 6;
    const dy = Math.sin(angle) * 6;
    return `
      <circle class="component-symbol" cx="${mid.x}" cy="${mid.y}" r="12" />
      <text class="component-label" x="${mid.x + dx}" y="${mid.y + dy - 2}">+</text>
      <text class="component-label" x="${mid.x - dx}" y="${mid.y - dy + 8}">−</text>
    `;
  }

  const arrowStart = {
    x: mid.x - Math.cos(angle) * 6,
    y: mid.y - Math.sin(angle) * 6,
  };
  const arrowEnd = {
    x: mid.x + Math.cos(angle) * 6,
    y: mid.y + Math.sin(angle) * 6,
  };

  return `
    <circle class="component-symbol" cx="${mid.x}" cy="${mid.y}" r="12" />
    <line class="component-symbol" x1="${arrowStart.x}" y1="${arrowStart.y}" x2="${arrowEnd.x}" y2="${arrowEnd.y}"
      marker-end="url(#arrow)" />
  `;
}

function renderNode(nodeId, ground, point, theme, options) {
  const { nodeRadius = DEFAULT_LAYOUT.nodeRadius, labelOffset = DEFAULT_LAYOUT.labelOffset } = options;
  const label = nodeId === ground ? 'GND' : nodeId;
  return `
    <g class="node" data-node-id="${nodeId}">
      <circle class="node" cx="${point.x}" cy="${point.y}" r="${nodeRadius}" />
      <text class="node-label" x="${point.x + labelOffset}" y="${point.y - labelOffset}">${label}</text>
    </g>
  `;
}

function currentFlowStyle(current, flow) {
  const magnitude = Math.abs(current);
  const normalized = Math.min(1, magnitude / flow.referenceCurrent);
  const duration = flow.maxDuration - (flow.maxDuration - flow.minDuration) * normalized;
  const opacity = flow.minOpacity + (1 - flow.minOpacity) * normalized;
  return {
    duration: duration.toFixed(2),
    opacity: opacity.toFixed(2),
    direction: current >= 0 ? 'normal' : 'reverse',
  };
}

function getComponentOrientation(component) {
  if (component.type === 'resistor') {
    return { fromNode: component.nodeA, toNode: component.nodeB };
  }
  if (component.type === 'voltageSource') {
    return { fromNode: component.positiveNode, toNode: component.negativeNode };
  }
  return { fromNode: component.fromNode, toNode: component.toNode };
}

function midpoint(start, end) {
  return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}
