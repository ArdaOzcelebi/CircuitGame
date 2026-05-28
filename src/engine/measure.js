import { Netlist, solveMNA } from './circuit.js';

function nodeVoltage(solution, nodeId) {
  return solution.nodeVoltages[nodeId] ?? 0;
}

export function measureVoltage(solution, redNode, blackNode) {
  if (!solution?.nodeVoltages) throw new Error('Invalid solution');
  return nodeVoltage(solution, redNode) - nodeVoltage(solution, blackNode);
}

function sourcesPoweredOff(netlist) {
  const off = new Netlist({ ground: netlist.ground });

  for (const component of netlist.components) {
    if (component.type === 'resistor') {
      off.addResistor(component.id, component.nodeA, component.nodeB, component.resistanceOhms);
    } else if (component.type === 'voltageSource') {
      // Turn off independent voltage source => short circuit (0 V source).
      off.addVoltageSource(component.id, component.positiveNode, component.negativeNode, 0);
    } else if (component.type === 'currentSource') {
      // Turn off independent current source => open circuit (remove).
    } else {
      throw new Error(`Unknown component type: ${component.type}`);
    }
  }

  return off;
}

export function equivalentResistance(netlist, nodeA, nodeB) {
  if (nodeA === nodeB) {
    return { ok: true, resistanceOhms: 0 };
  }

  const off = sourcesPoweredOff(netlist);

  try {
    const testNetlist = new Netlist({ ground: off.ground });
    for (const component of off.components) {
      if (component.type === 'resistor') {
        testNetlist.addResistor(component.id, component.nodeA, component.nodeB, component.resistanceOhms);
      } else if (component.type === 'voltageSource') {
        testNetlist.addVoltageSource(
          component.id,
          component.positiveNode,
          component.negativeNode,
          component.voltageVolts,
        );
      }
    }

    // Stamp direction to make V(nodeA)-V(nodeB) positive for passive networks:
    // inject +1 A into nodeA and pull it out of nodeB.
    testNetlist.addCurrentSource('I_TEST', nodeB, nodeA, 1);
    const solution = solveMNA(testNetlist);
    const vab = measureVoltage(solution, nodeA, nodeB);

    if (!Number.isFinite(vab)) {
      return { ok: false, resistanceOhms: Infinity, error: 'Unstable solution' };
    }

    return { ok: true, resistanceOhms: vab };
  } catch (error) {
    return {
      ok: false,
      resistanceOhms: Infinity,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
