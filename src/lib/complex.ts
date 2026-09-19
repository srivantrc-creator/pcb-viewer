// Minimal complex number arithmetic. Used so the same nodal-analysis
// solver handles both DC circuits (imaginary part always 0) and AC/phasor
// circuits (impedances and sources with phase), without two code paths.

export interface Complex {
  re: number;
  im: number;
}

export const C = (re: number, im = 0): Complex => ({ re, im });
export const ZERO: Complex = C(0, 0);
export const ONE: Complex = C(1, 0);

export function add(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}
export function sub(a: Complex, b: Complex): Complex {
  return { re: a.re - b.re, im: a.im - b.im };
}
export function mul(a: Complex, b: Complex): Complex {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
export function div(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return C(NaN, NaN);
  return {
    re: (a.re * b.re + a.im * b.im) / denom,
    im: (a.im * b.re - a.re * b.im) / denom,
  };
}
export function neg(a: Complex): Complex {
  return { re: -a.re, im: -a.im };
}
export function conj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}
export function mag(a: Complex): number {
  return Math.hypot(a.re, a.im);
}
export function phaseDeg(a: Complex): number {
  return (Math.atan2(a.im, a.re) * 180) / Math.PI;
}

/** Build a phasor from magnitude + phase in degrees: mag * e^(j*phase). */
export function fromPolarDeg(magnitude: number, phaseDegrees: number): Complex {
  const rad = (phaseDegrees * Math.PI) / 180;
  return { re: magnitude * Math.cos(rad), im: magnitude * Math.sin(rad) };
}

/** Impedance of an inductor L at angular frequency omega: jwL. */
export function impedanceL(L: number, omega: number): Complex {
  return C(0, omega * L);
}

/** Impedance of a capacitor C at angular frequency omega: 1/(jwC). */
export function impedanceC(cap: number, omega: number): Complex {
  if (omega === 0 || cap === 0) return C(Infinity, 0); // open circuit (DC steady state)
  return div(ONE, C(0, omega * cap));
}

export function isFiniteComplex(a: Complex): boolean {
  return isFinite(a.re) && isFinite(a.im);
}

export function fmt(a: Complex, digits = 4): string {
  if (!isFiniteComplex(a)) return "∞"; // infinity symbol, e.g. open circuit
  const re = Number(a.re.toPrecision(digits));
  const im = Number(a.im.toPrecision(digits));
  if (Math.abs(im) < 1e-9) return `${re}`;
  const sign = im >= 0 ? "+" : "-";
  return `${re} ${sign} j${Math.abs(im)}`;
}
