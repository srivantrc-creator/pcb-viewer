// NMOS operating-point and common-source small-signal gain calculator.
// Uses the standard square-law model taught in intro
// circuits/electronics: iD = kn[(VGS-Vtn)VDS - VDS^2/2] in triode,
// iD = (kn/2)(VGS-Vtn)^2 (1 + lambda*VDS) in saturation.

export type MosfetRegion = "cutoff" | "triode" | "saturation";

export interface MosfetBiasInput {
  vgs: number; // V
  vds: number; // V
  vtn: number; // threshold voltage, V
  kn: number; // process transconductance parameter kn' * (W/L), A/V^2
  lambda: number; // channel-length modulation, 1/V (0 = ignore)
}

export interface MosfetBiasResult {
  region: MosfetRegion;
  vov: number; // overdrive voltage Vgs - Vtn
  id: number; // drain current, A
  gm: number; // transconductance at this bias point, A/V (0 outside saturation)
  ro: number; // output resistance, ohms (Infinity if lambda = 0)
  steps: string[];
}

export function analyzeMosfetBias(input: MosfetBiasInput): MosfetBiasResult {
  const { vgs, vds, vtn, kn, lambda } = input;
  const vov = vgs - vtn;
  const steps: string[] = [];
  steps.push(`Overdrive voltage: V_OV = V_GS − V_tn = ${vgs} − ${vtn} = ${vov.toFixed(3)} V.`);

  if (vov <= 0) {
    steps.push(`V_OV ≤ 0 → the channel never forms → CUTOFF. I_D = 0.`);
    return { region: "cutoff", vov, id: 0, gm: 0, ro: Infinity, steps };
  }

  if (vds < vov) {
    const id = kn * (vov * vds - (vds * vds) / 2);
    steps.push(`Check region: V_DS (${vds}) < V_OV (${vov.toFixed(3)}) → TRIODE (linear) region.`);
    steps.push(`I_D = k_n[V_OV·V_DS − V_DS²/2] = ${kn}[${vov.toFixed(3)}×${vds} − ${vds}²/2] = ${id.toFixed(5)} A.`);
    steps.push("gm isn't meaningful as a small-signal amplifier parameter in triode (that's why amplifiers bias into saturation).");
    return { region: "triode", vov, id, gm: 0, ro: Infinity, steps };
  }

  const idSat0 = (kn / 2) * vov * vov;
  const id = idSat0 * (1 + lambda * vds);
  const gm = kn * vov; // = 2*ID/VOV at lambda=0; using the idealized (lambda=0) gm is standard for hand analysis
  const ro = lambda === 0 ? Infinity : 1 / (lambda * id);

  steps.push(`Check region: V_DS (${vds}) ≥ V_OV (${vov.toFixed(3)}) → SATURATION.`);
  steps.push(`I_D = (k_n/2)·V_OV²·(1+λV_DS) = (${kn}/2)(${vov.toFixed(3)})²(1+${lambda}×${vds}) = ${id.toFixed(5)} A.`);
  steps.push(`g_m = k_n·V_OV = ${kn}×${vov.toFixed(3)} = ${gm.toFixed(5)} A/V.`);
  steps.push(
    lambda === 0
      ? "λ = 0 → r_o = ∞ (ideal current source output)."
      : `r_o = 1/(λ·I_D) = 1/(${lambda}×${id.toFixed(5)}) = ${ro.toFixed(1)} Ω.`
  );

  return { region: "saturation", vov, id, gm, ro, steps };
}

export interface CommonSourceGainInput {
  gm: number; // A/V
  ro: number; // ohms (Infinity allowed)
  rd: number; // drain resistor, ohms
  rs: number; // source resistor (0 = bypassed/no degeneration), ohms
}

export interface CommonSourceGainResult {
  gain: number; // Av = vout/vin
  rOut: number; // small-signal output resistance
  steps: string[];
}

export function commonSourceGain(input: CommonSourceGainInput): CommonSourceGainResult {
  const { gm, ro, rd, rs } = input;
  const roParallelRd = isFinite(ro) ? (ro * rd) / (ro + rd) : rd;
  const steps: string[] = [];

  if (rs === 0) {
    const gain = -gm * roParallelRd;
    steps.push(`Source is bypassed (R_S = 0 for small-signal purposes).`);
    steps.push(
      isFinite(ro)
        ? `A_v = −g_m·(R_D ∥ r_o) = −${gm.toFixed(5)} × (${rd} ∥ ${ro.toFixed(1)}) = −${gm.toFixed(5)} × ${roParallelRd.toFixed(1)} = ${gain.toFixed(3)}`
        : `A_v = −g_m·R_D (r_o = ∞) = −${gm.toFixed(5)} × ${rd} = ${gain.toFixed(3)}`
    );
    return { gain, rOut: roParallelRd, steps };
  }

  // With source degeneration, using the common approximate (ro -> infinity) formula,
  // then noting the ro-corrected version qualitatively.
  const gainApprox = -(rd) / (rs + 1 / gm);
  steps.push(`Source degeneration resistor R_S = ${rs} Ω is present (not bypassed).`);
  steps.push(
    `Using the standard approximation (r_o → ∞): A_v ≈ −R_D / (R_S + 1/g_m) = −${rd} / (${rs} + ${(1 / gm).toFixed(5)}) = ${gainApprox.toFixed(3)}`
  );
  if (isFinite(ro)) {
    steps.push(
      "Including a finite r_o makes the exact expression messier — this approximation is what's normally used for hand analysis in an intro course."
    );
  }
  return { gain: gainApprox, rOut: roParallelRd, steps };
}
