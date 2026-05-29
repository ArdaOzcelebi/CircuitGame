function findComponent(netlist, componentId) {
  if (!netlist?.components || !componentId) return null;
  return netlist.components.find((c) => c.id === componentId) ?? null;
}

function terminalsFor(component) {
  if (!component) return null;
  if (component.type === 'resistor') return { a: component.nodeA, b: component.nodeB };
  if (component.type === 'voltageSource') return { a: component.positiveNode, b: component.negativeNode };
  if (component.type === 'currentSource') return { a: component.fromNode, b: component.toNode };
  if (component.type === 'diode' || component.type === 'zenerDiode') return { a: component.anodeNode, b: component.cathodeNode };
  if (component.type === 'idealOpAmp') return { a: component.outputNode, b: component.referenceNode };
  if (component.type === 'bjtNpn' || component.type === 'bjtPnp') return { a: component.collectorNode, b: component.emitterNode };
  if (component.type === 'mosfetN' || component.type === 'mosfetP') return { a: component.drainNode, b: component.sourceNode };
  return null;
}

function highlightNodes(...nodeIds) {
  return { nodes: nodeIds.filter(Boolean), components: [] };
}

function highlightComponent(componentId, terminals) {
  const nodes = [];
  if (terminals?.a) nodes.push(terminals.a);
  if (terminals?.b) nodes.push(terminals.b);
  return { nodes, components: componentId ? [componentId] : [] };
}

export function getProgressiveHints({ question, netlist } = {}) {
  if (!question) return [];

  if (question.kind === 'voltage') {
    const { redNode, blackNode, nodeA, nodeB } = question.meta ?? {};
    const a = redNode ?? nodeA;
    const b = blackNode ?? nodeB;
    return [
      {
        level: 1,
        title: 'Theory',
        text: 'Voltage between two nodes is the difference of their electric potentials: V(a) − V(b).',
        highlight: { nodes: [], components: [] },
      },
      {
        level: 2,
        title: 'Application',
        text: `Focus on nodes ${a} and ${b}.`,
        highlight: highlightNodes(a, b),
      },
      {
        level: 3,
        title: 'Walkthrough',
        text: `Set the multimeter to V and measure V(${a}) − V(${b}) (red on ${a}, black on ${b}).`,
        highlight: highlightNodes(a, b),
      },
    ];
  }

  if (question.kind === 'current') {
    const componentId = question.meta?.componentId ?? null;
    const component = findComponent(netlist, componentId);
    const terminals = terminalsFor(component);
    const type = component?.type ?? 'branch';

    const theory =
      type === 'resistor'
        ? "Use Ohm's Law: current is set by the voltage drop and resistance."
        : type === 'currentSource'
          ? 'An ideal current source enforces its current regardless of the rest of the circuit.'
          : type === 'diode'
            ? 'A diode current depends on its voltage (it strongly conducts when forward-biased).'
            : type === 'zenerDiode'
              ? 'A zener conducts forward like a diode, and in reverse once breakdown is reached.'
              : type === 'idealOpAmp'
                ? "Use ideal op-amp rules (virtual short + KCL) to solve currents in the connected network."
                : 'Use KCL/KVL and the device law for that element.';

    const walkthrough =
      type === 'resistor' && terminals
        ? `Compute I ≈ (V(${terminals.a}) − V(${terminals.b})) / R.`
        : type === 'currentSource'
          ? 'Read the source’s labeled current and use its sign convention.'
          : type === 'diode' && terminals
            ? `Use Vd = V(${terminals.a}) − V(${terminals.b}), then Id ≈ Is · (exp(Vd/(n·Vt)) − 1).`
            : type === 'zenerDiode' && terminals
              ? `Use Vd = V(${terminals.a}) − V(${terminals.b}); forward acts like a diode, reverse clamps near −Vz in breakdown.`
              : 'Switch to A mode and drag the red probe onto the branch to read its current.';

    return [
      { level: 1, title: 'Theory', text: theory, highlight: { nodes: [], components: [] } },
      {
        level: 2,
        title: 'Application',
        text: componentId ? `Focus on ${componentId}.` : 'Focus on the highlighted branch.',
        highlight: highlightComponent(componentId, terminals),
      },
      {
        level: 3,
        title: 'Walkthrough',
        text: walkthrough,
        highlight: highlightComponent(componentId, terminals),
      },
    ];
  }

  if (question.kind === 'resistance') {
    const { nodeA, nodeB, sourceId } = question.meta ?? {};
    return [
      {
        level: 1,
        title: 'Theory',
        text: 'To find equivalent resistance, turn off independent sources and reduce the network (or use a test source).',
        highlight: { nodes: [], components: [] },
      },
      {
        level: 2,
        title: 'Application',
        text: `Focus on nodes ${nodeA} and ${nodeB}${sourceId ? ` (at ${sourceId})` : ''}.`,
        highlight: highlightNodes(nodeA, nodeB),
      },
      {
        level: 3,
        title: 'Walkthrough',
        text: `Apply a 1 A test current from ${nodeB} → ${nodeA}, solve Vab = V(${nodeA}) − V(${nodeB}), then Req = Vab / 1 A.`,
        highlight: highlightNodes(nodeA, nodeB),
      },
    ];
  }

  if (question.kind === 'power') {
    const componentId = question.meta?.componentId ?? null;
    const component = findComponent(netlist, componentId);
    const terminals = terminalsFor(component);
    return [
      {
        level: 1,
        title: 'Theory',
        text: 'Power in a resistor is P = I²R (also P = V²/R).',
        highlight: { nodes: [], components: [] },
      },
      {
        level: 2,
        title: 'Application',
        text: componentId ? `Focus on ${componentId}.` : 'Focus on the highlighted element.',
        highlight: highlightComponent(componentId, terminals),
      },
      {
        level: 3,
        title: 'Walkthrough',
        text: 'Find the current through the resistor, then compute P = I² · R.',
        highlight: highlightComponent(componentId, terminals),
      },
    ];
  }

  return [
    { level: 1, title: 'Theory', text: 'Use KCL/KVL and the device law for the highlighted elements.', highlight: { nodes: [], components: [] } },
    { level: 2, title: 'Application', text: 'Identify the nodes/components involved in the question.', highlight: { nodes: [], components: [] } },
    { level: 3, title: 'Walkthrough', text: 'Write the governing equation using the circuit’s node voltages and component values.', highlight: { nodes: [], components: [] } },
  ];
}

