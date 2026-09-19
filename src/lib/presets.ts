import type { CircuitElement } from "./circuitTypes";

export interface Preset {
  name: string;
  description: string;
  mode: "DC" | "AC";
  freqHz?: number;
  elements: CircuitElement[];
}

export const PRESETS: Preset[] = [
  {
    name: "Voltage divider",
    description: "Classic two-resistor divider — good first check of the solver.",
    mode: "DC",
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 12 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 2000 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 4000 },
    ],
  },
  {
    name: "Series-parallel network",
    description: "R1 in series with (R2 parallel R3) — practice combining resistors.",
    mode: "DC",
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 24 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 100 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 300 },
      { id: "R3", type: "resistor", label: "R3", nodeA: 2, nodeB: 0, value: 150 },
    ],
  },
  {
    name: "Wheatstone bridge",
    description: "Four resistors + a bridge resistor — try nodal analysis by hand and compare.",
    mode: "DC",
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 10 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 1000 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 1, nodeB: 3, value: 2000 },
      { id: "R3", type: "resistor", label: "R3", nodeA: 2, nodeB: 0, value: 1500 },
      { id: "R4", type: "resistor", label: "R4", nodeA: 3, nodeB: 0, value: 3000 },
      { id: "Rg", type: "resistor", label: "Rg", nodeA: 2, nodeB: 3, value: 500 },
    ],
  },
  {
    name: "Two sources (superposition demo)",
    description: "One voltage + one current source — use the Superposition tab to see each one's contribution.",
    mode: "DC",
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 12 },
      { id: "Is", type: "isource", label: "Is", nodeA: 0, nodeB: 2, value: 0.01 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 400 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 800 },
    ],
  },
  {
    name: "Thevenin practice network",
    description: "Remove a load and use the Thevenin tab to find the equivalent seen at node 2.",
    mode: "DC",
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 15 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 1000 },
      { id: "R2", type: "resistor", label: "R2", nodeA: 2, nodeB: 0, value: 2000 },
      { id: "R3", type: "resistor", label: "R3", nodeA: 1, nodeB: 0, value: 3000 },
    ],
  },
  {
    name: "AC RC low-pass filter",
    description: "Series R and C driven by a sinusoidal source — try different frequencies and watch the phase shift.",
    mode: "AC",
    freqHz: 1000,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 10, phaseDeg: 0 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 1000 },
      { id: "C1", type: "capacitor", label: "C1", nodeA: 2, nodeB: 0, value: 1e-7 },
    ],
  },
  {
    name: "AC RLC series",
    description: "R, L, and C in series — find the impedance and phase at a given frequency.",
    mode: "AC",
    freqHz: 500,
    elements: [
      { id: "Vs", type: "vsource", label: "Vs", nodeA: 1, nodeB: 0, value: 10, phaseDeg: 0 },
      { id: "R1", type: "resistor", label: "R1", nodeA: 1, nodeB: 2, value: 50 },
      { id: "L1", type: "inductor", label: "L1", nodeA: 2, nodeB: 3, value: 0.05 },
      { id: "C1", type: "capacitor", label: "C1", nodeA: 3, nodeB: 0, value: 2e-6 },
    ],
  },
];
