// Higher-level circuit analyses built on top of the MNA solver:
// Thevenin/Norton equivalents and superposition breakdowns. Both work by
// re-solving modified copies of the netlist — the same trick you'd do by
// hand (zero the other sources, or inject a test source).

import { type Complex, C, div, sub, ZERO } from "./complex";
import { solveCircuit } from "./mna";
import type { Netlist, CircuitElement } from "./circuitTypes";

/** Copy of a netlist with every independent source EXCEPT `keepId` zeroed
 * out (voltage sources become 0V = short, current sources become 0A = open). */
function zeroOtherSources(netlist: Netlist, keepId: string | null): Netlist {
  return {
    ...netlist,
    elements: netlist.elements.map((el) => {
      if (el.type !== "vsource" && el.type !== "isource") return el;
      if (el.id === keepId) return el;
      return { ...el, value: 0 };
    }),
  };
}

export interface TheveninResult {
  vth: Complex; // open-circuit voltage, portP - portN
  zth: Complex; // Thevenin impedance (resistance, for DC)
  inNorton: Complex; // Norton equivalent current, vth / zth
  error?: string;
}

/**
 * Compute the Thevenin/Norton equivalent seen looking into (portP, portN).
 * The netlist should NOT include a load between the two ports — this
 * computes what a load connected there would see.
 */
export function computeThevenin(
  netlist: Netlist,
  portP: number,
  portN: number,
  omega: number
): TheveninResult {
  // 1. Open-circuit voltage: just solve the circuit as-is.
  const openResult = solveCircuit(netlist, omega);
  if (openResult.error) {
    return { vth: ZERO, zth: ZERO, inNorton: ZERO, error: openResult.error };
  }
  const vp = openResult.nodeVoltages.get(portP) ?? ZERO;
  const vn = openResult.nodeVoltages.get(portN) ?? ZERO;
  const vth = sub(vp, vn);

  // 2. Zero all independent sources, inject a 1A test source from portN to
  // portP (so it delivers current INTO portP, per the isource convention),
  // and measure the resulting voltage — that's Zth for a 1A test current.
  const deadNetlist = zeroOtherSources(netlist, null);
  const testElement: CircuitElement = {
    id: "__test_source__",
    type: "isource",
    label: "Itest",
    nodeA: portN,
    nodeB: portP,
    value: 1,
  };
  const testNetlist: Netlist = {
    ...deadNetlist,
    elements: [...deadNetlist.elements, testElement],
  };
  const testResult = solveCircuit(testNetlist, omega);
  if (testResult.error) {
    return {
      vth,
      zth: ZERO,
      inNorton: ZERO,
      error:
        "Couldn't compute Rth/Zth — with sources zeroed, the port nodes may be floating or shorted. " +
        testResult.error,
    };
  }
  const tp = testResult.nodeVoltages.get(portP) ?? ZERO;
  const tn = testResult.nodeVoltages.get(portN) ?? ZERO;
  const zth = sub(tp, tn); // divided by test current of 1A, so it's just the voltage

  const inNorton = zth.re === 0 && zth.im === 0 ? ZERO : div(vth, zth);

  return { vth, zth, inNorton };
}

export interface SuperpositionRow {
  sourceId: string;
  sourceLabel: string;
  contribution: Complex; // this source's contribution to the target node voltage
}

export interface SuperpositionResult {
  rows: SuperpositionRow[];
  total: Complex; // sum of all contributions — should match the full solve
  fullSolve: Complex; // node voltage from solving with all sources active, for comparison
  error?: string;
}

/**
 * Superposition breakdown: for each independent source, solve the circuit
 * with only that source active (others zeroed) and report its contribution
 * to `targetNode`'s voltage. The contributions should sum to the full
 * circuit's node voltage — that sum is itself the superposition theorem.
 */
export function superpositionBreakdown(
  netlist: Netlist,
  targetNode: number,
  omega: number
): SuperpositionResult {
  const sources = netlist.elements.filter(
    (e) => e.type === "vsource" || e.type === "isource"
  );

  const rows: SuperpositionRow[] = [];
  let total: Complex = C(0, 0);

  for (const src of sources) {
    const isolated = zeroOtherSources(netlist, src.id);
    const result = solveCircuit(isolated, omega);
    if (result.error) {
      return { rows: [], total: ZERO, fullSolve: ZERO, error: result.error };
    }
    const v = result.nodeVoltages.get(targetNode) ?? ZERO;
    rows.push({ sourceId: src.id, sourceLabel: src.label, contribution: v });
    total = { re: total.re + v.re, im: total.im + v.im };
  }

  const full = solveCircuit(netlist, omega);
  const fullSolve = full.nodeVoltages.get(targetNode) ?? ZERO;

  return { rows, total, fullSolve, error: full.error };
}
