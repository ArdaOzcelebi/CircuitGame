function el(tag, { className, text } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function uniqueComponentTypes(netlist) {
  const types = new Set();
  for (const c of netlist?.components ?? []) types.add(c.type);
  return [...types].sort();
}

function glossaryEntries(types) {
  const entries = [];

  const push = (type, title, body) => {
    if (!types.includes(type)) return;
    entries.push({ title, body });
  };

  push('resistor', 'Resistor', "Limits current and sets voltage drops via Ohm's Law (V = I·R).");
  push('voltageSource', 'Voltage Source', 'Forces a fixed voltage difference between its terminals.');
  push('currentSource', 'Current Source', 'Forces a fixed current from its from-node to its to-node.');
  push('diode', 'Diode', 'Conducts strongly when forward-biased and blocks when reverse-biased (approximately).');
  push('zenerDiode', 'Zener Diode', 'Acts like a diode forward, and clamps in reverse once breakdown is reached.');
  push('bjtNpn', 'NPN BJT', 'A current-controlled device: base-emitter forward bias allows collector current.');
  push('bjtPnp', 'PNP BJT', 'Like NPN, but with polarities flipped (conducts when base is below emitter).');
  push('mosfetN', 'N-channel MOSFET', 'A voltage-controlled switch: turns on when Vgs exceeds threshold.');
  push('mosfetP', 'P-channel MOSFET', 'Turns on when Vsg exceeds threshold (source higher than gate).');
  push(
    'idealOpAmp',
    'Ideal Op-Amp',
    'Use the golden rules (with negative feedback): input currents are ~0 and V+ ≈ V−.',
  );

  return entries;
}

function endpoints(component) {
  if (component.type === 'resistor') return { a: component.nodeA, b: component.nodeB };
  if (component.type === 'voltageSource') return { a: component.positiveNode, b: component.negativeNode };
  if (component.type === 'currentSource') return { a: component.fromNode, b: component.toNode };
  if (component.type === 'diode' || component.type === 'zenerDiode') return { a: component.anodeNode, b: component.cathodeNode };
  if (component.type === 'idealOpAmp') return { a: component.outputNode, b: component.referenceNode };
  if (component.type === 'bjtNpn' || component.type === 'bjtPnp') return { a: component.collectorNode, b: component.emitterNode };
  if (component.type === 'mosfetN' || component.type === 'mosfetP') return { a: component.drainNode, b: component.sourceNode };
  return null;
}

function findResistorBetween(netlist, nodeA, nodeB) {
  return (
    netlist.components.find(
      (c) =>
        c.type === 'resistor' &&
        ((c.nodeA === nodeA && c.nodeB === nodeB) || (c.nodeA === nodeB && c.nodeB === nodeA)),
    ) ?? null
  );
}

function findVoltageSourceToGround(netlist) {
  const g = netlist.ground;
  return netlist.components.find((c) => c.type === 'voltageSource' && (c.positiveNode === g || c.negativeNode === g)) ?? null;
}

function detectTopologies(netlist) {
  const found = [];
  if (!netlist) return found;

  const g = netlist.ground;
  const vsrc = findVoltageSourceToGround(netlist);
  const vNode = vsrc ? (vsrc.positiveNode === g ? vsrc.negativeNode : vsrc.positiveNode) : null;

  // Voltage divider: vNode --R-- mid --R-- g
  if (vNode) {
    const resistors = netlist.components.filter((c) => c.type === 'resistor');
    for (const r1 of resistors) {
      const ep1 = endpoints(r1);
      if (!ep1) continue;
      const mid = ep1.a === vNode ? ep1.b : ep1.b === vNode ? ep1.a : null;
      if (!mid || mid === g) continue;
      const r2 = findResistorBetween(netlist, mid, g);
      if (!r2) continue;
      found.push({
        title: 'Voltage Divider',
        body: `Two resistors in series split the source voltage. The midpoint node (${mid}) is a fraction of the input.`,
      });
      break;
    }
  }

  // Zener regulator: vNode --R-- vout, zener between vout and ground (reverse breakdown clamp)
  if (vNode) {
    const resistors = netlist.components.filter((c) => c.type === 'resistor');
    const zeners = netlist.components.filter((c) => c.type === 'zenerDiode');
    for (const r of resistors) {
      const a = r.nodeA === vNode ? r.nodeB : r.nodeB === vNode ? r.nodeA : null;
      if (!a || a === g) continue;
      const z = zeners.find((z0) => (z0.cathodeNode === a && z0.anodeNode === g) || (z0.cathodeNode === g && z0.anodeNode === a));
      if (!z) continue;
      found.push({
        title: 'Zener Regulator / Clamp',
        body: `A series resistor feeds a node that is clamped by a zener diode near its breakdown voltage.`,
      });
      break;
    }
  }

  // Diode clipper: vNode --R-- vout, diode vout -> ground
  if (vNode) {
    const resistors = netlist.components.filter((c) => c.type === 'resistor');
    const diodes = netlist.components.filter((c) => c.type === 'diode');
    for (const r of resistors) {
      const vout = r.nodeA === vNode ? r.nodeB : r.nodeB === vNode ? r.nodeA : null;
      if (!vout || vout === g) continue;
      const d = diodes.find((d0) => (d0.anodeNode === vout && d0.cathodeNode === g) || (d0.anodeNode === g && d0.cathodeNode === vout));
      if (!d) continue;
      found.push({
        title: 'Diode Clipper',
        body: 'A diode shunts a node to ground when forward biased, limiting the voltage swing.',
      });
      break;
    }
  }

  // Inverting op-amp: V+ at ground, resistor to V− from a source node, feedback resistor from out to V−
  const opamp = netlist.components.find((c) => c.type === 'idealOpAmp') ?? null;
  if (opamp && opamp.nonInvertingNode === g) {
    const inv = opamp.invertingNode;
    const out = opamp.outputNode;
    const feedback = netlist.components.find((c) => c.type === 'resistor' && ((c.nodeA === out && c.nodeB === inv) || (c.nodeB === out && c.nodeA === inv)));
    const input = netlist.components.find((c) => c.type === 'resistor' && (c.nodeA === inv || c.nodeB === inv) && c !== feedback);
    if (feedback && input) {
      found.push({
        title: 'Inverting Op-Amp',
        body: 'Negative feedback forces the inverting input near virtual ground. Gain is approximately −Rf/Rin.',
      });
    }
  }

  // NPN switch: emitter at ground, collector pulled up by resistor to a supply node
  const npn = netlist.components.find((c) => c.type === 'bjtNpn' && c.emitterNode === g) ?? null;
  if (npn) {
    const pullup = netlist.components.find(
      (c) => c.type === 'resistor' && ((c.nodeA === npn.collectorNode && c.nodeB !== g) || (c.nodeB === npn.collectorNode && c.nodeA !== g)),
    );
    if (pullup) {
      found.push({
        title: 'Transistor Low-Side Switch',
        body: 'A base signal controls a larger collector current, pulling the collector node low when the transistor turns on.',
      });
    }
  }

  return found;
}

export function createManualController({ containerEl } = {}) {
  if (!(containerEl instanceof HTMLElement)) {
    throw new Error('Manual controller requires a container element');
  }

  function renderSection(title, items) {
    const section = el('section', { className: 'manual__section' });
    section.append(el('div', { className: 'manual__heading', text: title }));
    if (!items.length) {
      section.append(el('div', { className: 'manual__empty', text: '—' }));
      return section;
    }
    const list = el('ul', { className: 'manual__list' });
    for (const item of items) {
      const li = el('li', { className: 'manual__item' });
      li.append(el('div', { className: 'manual__itemTitle', text: item.title }));
      li.append(el('div', { className: 'manual__itemBody', text: item.body }));
      list.append(li);
    }
    section.append(list);
    return section;
  }

  function setCircuit({ netlist } = {}) {
    if (!netlist) {
      containerEl.textContent = '';
      return;
    }

    const types = uniqueComponentTypes(netlist);
    const glossary = glossaryEntries(types);
    const topologies = detectTopologies(netlist);

    containerEl.replaceChildren(renderSection('Component Glossary', glossary), renderSection('Topology Overview', topologies));
  }

  return { setCircuit };
}

