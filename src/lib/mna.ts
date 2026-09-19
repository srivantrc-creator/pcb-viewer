import {
  type Complex,
  C,
  ZERO,
  add,
  div,
  fromPolarDeg,
  impedanceL,
  impedanceC,
} from "./complex";
import { solveComplexLinearSystem } from "./linalg";
import { type Netlist, type CircuitElement, nodeSet } from "./circuitTypes";

export interface SolveResult {
  /** Node voltage (phasor) by node number. Ground (0) is always 0. */
  nodeVoltages: Map<number, Complex>;
  /** Current (phasor) through each element, using the sign convention in
   * circuitTypes.ts: positive means flowing from nodeA to nodeB. */
  elementCurrents: Map<string, Complex>;
  error?: string;
}

/** Admittance (1/impedance) of a passive element at angular frequency omega. */
function admittance(el: CircuitElement, omega: number): Complex {
  if (el.type === "resistor") return C(1 / el.value, 0);
  if (el.type === "inductor") return div(C(1, 0), impedanceL(el.value, omega));
  if (el.type === "capacitor") {
    const z = impedanceC(el.value, omega);
    if (!isFinite(z.re) || !isFinite(z.im)) return C(0, 0); // open circuit at DC
    return div(C(1, 0), z);
  }
  return C(0, 0);
}

/**
 * Modified Nodal Analysis: solves for node voltages and voltage-source
 * branch currents given a netlist and angular frequency omega (0 for DC).
 * Ground is always node 0. See circuitTypes.ts for the sign convention.
 */
export function solveCircuit(netlist: Netlist, omega: number): SolveResult {
  const nodes = nodeSet(netlist).filter((n) => n !== 0);
  const nodeIndex = new Map<number, number>();
  nodes.forEach((n, i) => nodeIndex.set(n, i));
  const N = nodes.length;

  const vSources = netlist.elements.filter((e) => e.type === "vsource");
  const M = vSources.length;
  const size = N + M;

  if (size === 0) {
    return { nodeVoltages: new Map([[0, ZERO]]), elementCurrents: new Map() };
  }

  const A: Complex[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => C(0, 0))
  );
  const b: Complex[] = Array.from({ length: size }, () => C(0, 0));

  const idx = (node: number) => (node === 0 ? -1 : nodeIndex.get(node)!);

  for (const el of netlist.elements) {
    const a = idx(el.nodeA);
    const bIdx = idx(el.nodeB);

    if (el.type === "resistor" || el.type === "inductor" || el.type === "capacitor") {
      const y = admittance(el, omega);
      if (a >= 0) A[a][a] = add(A[a][a], y);
      if (bIdx >= 0) A[bIdx][bIdx] = add(A[bIdx][bIdx], y);
      if (a >= 0 && bIdx >= 0) {
        A[a][bIdx] = add(A[a][bIdx], { re: -y.re, im: -y.im });
        A[bIdx][a] = add(A[bIdx][a], { re: -y.re, im: -y.im });
      }
    } else if (el.type === "isource") {
      const I = fromPolarDeg(el.value, el.phaseDeg ?? 0);
      // Current flows from nodeA to nodeB through the source: nodeA loses
      // it, nodeB receives it (see circuitTypes.ts sign convention).
      if (a >= 0) b[a] = add(b[a], { re: -I.re, im: -I.im });
      if (bIdx >= 0) b[bIdx] = add(b[bIdx], I);
    }
  }

  // Voltage sources: augment with one branch-current unknown each.
  vSources.forEach((el, k) => {
    const row = N + k;
    const a = idx(el.nodeA);
    const bIdx = idx(el.nodeB);
    if (a >= 0) {
      A[a][row] = add(A[a][row], C(1, 0));
      A[row][a] = add(A[row][a], C(1, 0));
    }
    if (bIdx >= 0) {
      A[bIdx][row] = add(A[bIdx][row], C(-1, 0));
      A[row][bIdx] = add(A[row][bIdx], C(-1, 0));
    }
    b[row] = fromPolarDeg(el.value, el.phaseDeg ?? 0);
  });

  const x = solveComplexLinearSystem(A, b);
  if (!x) {
    return {
      nodeVoltages: new Map([[0, ZERO]]),
      elementCurrents: new Map(),
      error:
        "This circuit can't be solved as drawn — check for a floating node (not connected to ground) or a loop of voltage sources/shorts.",
    };
  }

  const nodeVoltages = new Map<number, Complex>([[0, ZERO]]);
  nodes.forEach((n, i) => nodeVoltages.set(n, x[i]));

  // x[N+k] is the MNA branch current defined flowing from nodeA to nodeB
  // THROUGH THE SOURCE. For an actual source, current flows the other way
  // internally (out of the + terminal, nodeA, into the external circuit) —
  // negate so "current" for a source reads the same way as for a resistor:
  // positive means flowing from nodeA into the rest of the circuit.
  const vSourceCurrent = new Map<string, Complex>();
  vSources.forEach((el, k) => vSourceCurrent.set(el.id, { re: -x[N + k].re, im: -x[N + k].im }));

  const elementCurrents = new Map<string, Complex>();
  for (const el of netlist.elements) {
    if (el.type === "vsource") {
      elementCurrents.set(el.id, vSourceCurrent.get(el.id)!);
      continue;
    }
    const va = nodeVoltages.get(el.nodeA)!;
    const vb = nodeVoltages.get(el.nodeB)!;
    if (el.type === "isource") {
      elementCurrents.set(el.id, fromPolarDeg(el.value, el.phaseDeg ?? 0));
      continue;
    }
    const y = admittance(el, omega);
    // Current from A to B through a passive element = (Va - Vb) * Y.
    elementCurrents.set(el.id, {
      re: (va.re - vb.re) * y.re - (va.im - vb.im) * y.im,
      im: (va.re - vb.re) * y.im + (va.im - vb.im) * y.re,
    });
  }

  return { nodeVoltages, elementCurrents };
}
