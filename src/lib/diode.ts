// Simple series diode circuit solver using the constant-voltage-drop (CVD)
// model — the standard intro-circuits approach (weeks 11-13): assume the
// diode is ON with a fixed forward drop Vgamma, solve, then check that the
// resulting current is actually positive (forward); if not, it's OFF.

export type DiodeOrientation = "forward" | "reverse";

export interface DiodeSeriesInput {
  sourceVoltage: number; // V
  resistance: number; // ohms
  forwardDrop: number; // Vgamma assumption: 0 (ideal), 0.3 (Ge), 0.7 (Si), etc.
  orientation: DiodeOrientation; // whether the source drives current in the diode's forward direction
}

export interface DiodeSeriesResult {
  state: "ON" | "OFF";
  current: number; // A, through the loop
  voltageAcrossDiode: number; // V
  voltageAcrossResistor: number; // V
  steps: string[]; // worked-solution steps, for display
}

export function solveDiodeSeries(input: DiodeSeriesInput): DiodeSeriesResult {
  const { sourceVoltage: vs, resistance: r, forwardDrop: vg, orientation } = input;
  const steps: string[] = [];

  if (orientation === "reverse") {
    steps.push("Source polarity reverse-biases the diode.");
    steps.push("An ideal/CVD diode blocks all current when reverse-biased, so I = 0.");
    steps.push(`With I = 0, there's no drop across R, so the full source voltage appears across the diode: V_D = ${(-Math.abs(vs)).toFixed(3)} V (reverse).`);
    return {
      state: "OFF",
      current: 0,
      voltageAcrossDiode: -Math.abs(vs),
      voltageAcrossResistor: 0,
      steps,
    };
  }

  steps.push(`Step 1 — Assume the diode is ON: V_D = Vγ = ${vg} V.`);
  const trialCurrent = (vs - vg) / r;
  steps.push(
    `Step 2 — Apply KVL around the loop: Vs = I·R + Vγ  →  I = (Vs − Vγ) / R = (${vs} − ${vg}) / ${r} = ${trialCurrent.toFixed(5)} A.`
  );

  if (trialCurrent > 0) {
    steps.push(`Step 3 — Check: I = ${trialCurrent.toFixed(5)} A > 0, consistent with the diode conducting. Assumption holds → diode is ON.`);
    return {
      state: "ON",
      current: trialCurrent,
      voltageAcrossDiode: vg,
      voltageAcrossResistor: trialCurrent * r,
      steps,
    };
  }

  steps.push(`Step 3 — Check: I = ${trialCurrent.toFixed(5)} A ≤ 0, which a diode can't do while "ON" (it can only conduct forward). Assumption fails → diode is OFF.`);
  steps.push(`Step 4 — With the diode OFF, I = 0, so there's no drop across R. The diode sees V_D = Vs = ${vs} V (below turn-on, so it stays off).`);
  return {
    state: "OFF",
    current: 0,
    voltageAcrossDiode: vs,
    voltageAcrossResistor: 0,
    steps,
  };
}

export const TYPICAL_FORWARD_DROPS = [
  { label: "Ideal diode", value: 0 },
  { label: "Germanium (Ge)", value: 0.3 },
  { label: "Silicon (Si)", value: 0.7 },
  { label: "Schottky", value: 0.2 },
  { label: "Red LED", value: 1.8 },
  { label: "Blue/White LED", value: 3.2 },
];
