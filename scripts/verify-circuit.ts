import { solveCircuit } from "../src/lib/mna";
import type { Netlist } from "../src/lib/circuitTypes";
import { mag, phaseDeg } from "../src/lib/complex";

function approx(a: number, b: number, tol = 1e-6) {
  return Math.abs(a - b) < tol;
}

// --- Test 1: simple voltage divider ---
// 10V source (node1 +, ground -), R1=100 (node1-node2), R2=200 (node2-ground)
// Expect V(node2) = 10 * 200/300 = 6.6667 V, source current = 10/300 = 0.03333 A
{
  const netlist: Netlist = {
    groundNode: 0,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 10 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 100 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 200 },
    ],
  };
  const result = solveCircuit(netlist, 0);
  const v2 = result.nodeVoltages.get(2)!.re;
  const v1 = result.nodeVoltages.get(1)!.re;
  const iVs = result.elementCurrents.get("Vs")!.re;
  const iR1 = result.elementCurrents.get("R1")!.re;
  console.log("Test 1: voltage divider");
  console.log(`  V1=${v1} (expect 10)`);
  console.log(`  V2=${v2} (expect 6.6667)`);
  console.log(`  I(Vs)=${iVs} I(R1)=${iR1} (expect current magnitude 0.03333)`);
  if (!approx(v1, 10)) throw new Error("V1 wrong");
  if (!approx(v2, 6.66666667, 1e-4)) throw new Error("V2 wrong");
  if (!approx(iVs, 0.03333333, 1e-4)) throw new Error("source current wrong (expect +0.0333, delivered out of + terminal)");
  if (!approx(iR1, 0.03333333, 1e-4)) throw new Error("R1 current wrong (should be +0.0333, flowing node1->node2)");
  console.log("  OK\n");
}

// --- Test 2: current source into a resistor to ground ---
// I=2A from node0(ground) to node1 external convention: define isource nodeA=0,nodeB=1 -> current flows INTO node1
// R=10 ohm from node1 to ground. Expect V1 = 2*10 = 20V
{
  const netlist: Netlist = {
    groundNode: 0,
    elements: [
      { id: "Is", type: "isource", label: "Is", nodeA: 0, nodeB: 1, value: 2 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 0, value: 10 },
    ],
  };
  const result = solveCircuit(netlist, 0);
  const v1 = result.nodeVoltages.get(1)!.re;
  console.log("Test 2: current source into resistor");
  console.log(`  V1=${v1} (expect 20)`);
  if (!approx(v1, 20)) throw new Error("V1 wrong for current source test");
  console.log("  OK\n");
}

// --- Test 3: Thevenin-style two-resistor network with a source, check power ---
// Classic: 12V source, R1=4 series to node A, R2=8 from node A to ground (load).
// Expect V(A) = 12*8/12=8V, I total = 12/12=1A, P(R2)=8^2/8=8W
{
  const netlist: Netlist = {
    groundNode: 0,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 12 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 4 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 8 },
    ],
  };
  const result = solveCircuit(netlist, 0);
  const vA = result.nodeVoltages.get(2)!.re;
  console.log("Test 3: series-parallel power check");
  console.log(`  V(node2)=${vA} (expect 8)`);
  if (!approx(vA, 8)) throw new Error("V(node2) wrong");
  console.log("  OK\n");
}

// --- Test 4: AC circuit — RC low-pass at omega, check impedance divider ---
// Vs = 10V (0 deg) AC, R=1000 ohm in series with C=1e-6F, omega=1000 rad/s
// Zc = 1/(jwC) = 1/(j*1000*1e-6) = 1/(j*0.001) = -j*1000 ohm
// Divider: Vc = Vs * Zc/(R+Zc) = 10 * (-j1000)/(1000 - j1000)
{
  const omega = 1000;
  const netlist: Netlist = {
    groundNode: 0,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 10, phaseDeg: 0 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 1000 },
      { id: "C1", type: "capacitor", label: "C1", nodeA: 2, nodeB: 0, value: 1e-6 },
    ],
  };
  const result = solveCircuit(netlist, omega);
  const vC = result.nodeVoltages.get(2)!;
  console.log("Test 4: AC RC divider");
  console.log(`  Vc = ${vC.re.toFixed(4)} + j${vC.im.toFixed(4)}, |Vc|=${mag(vC).toFixed(4)}, angle=${phaseDeg(vC).toFixed(2)} deg`);
  // Expected magnitude: 10 * 1000/sqrt(1000^2+1000^2) = 10/sqrt(2) = 7.0711
  if (!approx(mag(vC), 7.0711, 1e-3)) throw new Error("AC magnitude wrong");
  if (!approx(phaseDeg(vC), -45, 1e-2)) throw new Error("AC phase wrong");
  console.log("  OK\n");
}

console.log("All circuit-solver tests passed.");

// --- Thevenin test ---
import { computeThevenin, superpositionBreakdown } from "../src/lib/analysis";
{
  const netlist: Netlist = {
    groundNode: 0,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 12 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 4 },
    ],
  };
  const th = computeThevenin(netlist, 2, 0, 0);
  console.log("Thevenin test: Vth=", th.vth, "Zth=", th.zth);
  if (!approx(th.vth.re, 12)) throw new Error("Vth wrong");
  if (!approx(th.zth.re, 4)) throw new Error("Zth wrong");
  console.log("  OK\n");
}

// --- Superposition test ---
{
  const netlist: Netlist = {
    groundNode: 0,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 12 },
      { id: "Is", type: "isource", label: "Is", nodeA: 0, nodeB: 2, value: 1 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 4 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 8 },
    ],
  };
  const sp = superpositionBreakdown(netlist, 2, 0);
  console.log("Superposition test: rows=", sp.rows.map(r => `${r.sourceLabel}=${r.contribution.re.toFixed(4)}`), "total=", sp.total.re, "fullSolve=", sp.fullSolve.re);
  if (!approx(sp.total.re, sp.fullSolve.re, 1e-6)) throw new Error("Superposition sum doesn't match full solve");
  console.log("  OK\n");
}

console.log("All Thevenin/superposition tests passed.");
