// First-order RC/RL step-response calculator (weeks 6-7: natural response,
// step response, general solution x(t) = x(inf) + [x(0) - x(inf)] e^(-t/tau)).

export interface FirstOrderInput {
  kind: "RC" | "RL";
  r: number; // ohms
  cOrL: number; // farads (RC) or henries (RL)
  initialValue: number; // x(0): initial capacitor voltage or inductor current
  finalValue: number; // x(inf): steady-state value after the step (t -> infinity)
  quantityLabel: string; // e.g. "v_C(t)" or "i_L(t)", for display
  quantityUnit: string; // "V" or "A"
}

export interface FirstOrderResult {
  tau: number; // time constant, seconds
  x0: number;
  xInf: number;
  equation: string; // human-readable x(t) = ...
  samples: { t: number; x: number }[]; // for plotting, 0 to ~5*tau
}

export function solveFirstOrder(input: FirstOrderInput): FirstOrderResult {
  const tau = input.kind === "RC" ? input.r * input.cOrL : input.cOrL / input.r;
  const { initialValue: x0, finalValue: xInf } = input;
  const delta = x0 - xInf;

  const fmt = (n: number) => Number(n.toPrecision(4));
  const equation =
    delta === 0
      ? `${input.quantityLabel} = ${fmt(xInf)} ${input.quantityUnit} (already at steady state)`
      : `${input.quantityLabel}(t) = ${fmt(xInf)} ${delta >= 0 ? "+" : "-"} ${fmt(
          Math.abs(delta)
        )} e^(-t / ${fmt(tau)}s) ${input.quantityUnit}`;

  const samples: { t: number; x: number }[] = [];
  const tMax = tau > 0 ? tau * 5 : 1;
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const t = (tMax * i) / steps;
    const x = xInf + delta * Math.exp(-t / tau);
    samples.push({ t, x });
  }

  return { tau, x0, xInf, equation, samples };
}

/** t such that the response has settled within `fraction` of the final value
 * (e.g. 0.02 for "within 2%", the common "5 time constants" rule uses ~0.0067). */
export function settlingTime(tau: number, fraction = 0.02): number {
  return -tau * Math.log(fraction);
}
