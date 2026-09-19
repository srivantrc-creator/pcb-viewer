// Netlist model for the circuit builder. Node 0 is always ground.
// This same shape drives DC analysis (omega = 0, all values real) and AC
// phasor analysis (omega > 0, sources carry a phase) through one solver.

export type ElementType = "resistor" | "vsource" | "isource" | "inductor" | "capacitor";

export interface CircuitElement {
  id: string;
  type: ElementType;
  label: string; // e.g. "R1", "Vs", "C2"
  nodeA: number; // resistor/L/C: either terminal. Sources: "+" terminal (see circuitTypes docs below).
  nodeB: number; // Sources: "-" terminal / return path.
  value: number; // ohms, henries, farads, volts, or amps depending on `type`
  phaseDeg?: number; // AC sources only; degrees, default 0
}

// Sign convention (documented once, used consistently by mna.ts and the UI):
// - Resistor/Inductor/Capacitor: symmetric, nodeA/nodeB order doesn't matter.
// - Voltage source: nodeA is "+". Conventional current is defined flowing
//   OUT of the "+" terminal (nodeA) through the external circuit, same as a
//   battery driving a circuit.
// - Current source: the source forces current `value` to flow FROM nodeA
//   TO nodeB through the source itself (so externally, current is
//   delivered INTO nodeB and drawn FROM nodeA) — matching the arrow you'd
//   draw on the schematic symbol.

export interface Netlist {
  elements: CircuitElement[];
  groundNode: number; // always 0 by convention, kept explicit for clarity
}

export function nodeSet(netlist: Netlist): number[] {
  const nodes = new Set<number>();
  for (const el of netlist.elements) {
    nodes.add(el.nodeA);
    nodes.add(el.nodeB);
  }
  return [...nodes].sort((a, b) => a - b);
}

export function emptyNetlist(): Netlist {
  return { elements: [], groundNode: 0 };
}

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `el${idCounter}${Math.random().toString(36).slice(2, 6)}`;
}
