// Maps the ECE 20001-style 16-week syllabus to the tool that covers it, so
// the landing page can show "here's what to use this week" rather than a
// generic feature list.

export type ToolKey = "builder-dc" | "builder-ac" | "first-order" | "magnetics" | "diode" | "mosfet";

export interface SyllabusWeek {
  weeks: string;
  topics: string;
  tool: ToolKey | null;
  toolNote?: string;
}

export const SYLLABUS: SyllabusWeek[] = [
  { weeks: "1-2", topics: "Circuit elements, charge/current/voltage/power, sources, Ohm's law, KVL/KCL, resistor combinations, voltage/current division", tool: "builder-dc", toolNote: "Circuit Builder (DC)" },
  { weeks: "3-4", topics: "Nodal & mesh analysis, Thevenin's & Norton's theorems, source transformations", tool: "builder-dc", toolNote: "Circuit Builder (DC) + Thevenin/Norton tab" },
  { weeks: "5", topics: "Linearity & superposition, maximum power transfer, capacitors & inductors intro", tool: "builder-dc", toolNote: "Circuit Builder (DC) + Superposition tab" },
  { weeks: "6", topics: "First-order RC circuits", tool: "first-order", toolNote: "First-Order Calculator (RC)" },
  { weeks: "7", topics: "First-order RL circuits, general first-order solution, waveform classification", tool: "first-order", toolNote: "First-Order Calculator (RL)" },
  { weeks: "8", topics: "Complex numbers review, phasors, impedance & admittance of two-terminal devices", tool: "builder-ac", toolNote: "Circuit Builder (AC/phasor)" },
  { weeks: "9", topics: "Sinusoidal steady-state (SSS) analysis, instantaneous & average power", tool: "builder-ac", toolNote: "Circuit Builder (AC/phasor)" },
  { weeks: "10", topics: "Power transfer & SSS examples", tool: "builder-ac", toolNote: "Circuit Builder (AC/phasor)" },
  { weeks: "11", topics: "Magnetically-coupled circuits, ideal transformers, carriers in intrinsic semiconductors", tool: "magnetics", toolNote: "Magnetics & Transformer Calculator" },
  { weeks: "12", topics: "Carriers in doped semiconductors, energy bonding model, pn junction", tool: "diode", toolNote: "Diode Calculator (background reading — junction physics isn't a solver task)" },
  { weeks: "13", topics: "pn junction, diode circuits", tool: "diode", toolNote: "Diode Calculator" },
  { weeks: "14", topics: "MOSFET structure & operation", tool: "mosfet", toolNote: "MOSFET Calculator (bias point)" },
  { weeks: "15", topics: "MOSFET structure & circuits II", tool: "mosfet", toolNote: "MOSFET Calculator (bias point)" },
  { weeks: "16", topics: "MOSFET amplifiers", tool: "mosfet", toolNote: "MOSFET Calculator (common-source gain)" },
];
