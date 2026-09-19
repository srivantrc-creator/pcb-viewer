// Magnetically coupled circuits & ideal transformers (week 11).

export interface CouplingInput {
  l1: number; // primary self-inductance, H
  l2: number; // secondary self-inductance, H
  m: number; // mutual inductance, H
}

export interface CouplingResult {
  k: number; // coupling coefficient, 0-1 (1 = perfectly coupled)
  maxM: number; // maximum possible M given L1, L2 (k=1)
  classification: string;
}

export function analyzeCoupling(input: CouplingInput): CouplingResult {
  const maxM = Math.sqrt(input.l1 * input.l2);
  const k = maxM === 0 ? 0 : input.m / maxM;
  let classification = "Loosely coupled";
  if (k >= 0.95) classification = "Nearly ideal coupling (k ≈ 1)";
  else if (k >= 0.5) classification = "Moderately coupled";
  return { k, maxM, classification };
}

export interface TransformerInput {
  n1: number; // primary turns
  n2: number; // secondary turns
  primaryVoltage?: number; // V, optional
  secondaryLoadZ?: number; // ohms, optional — load on secondary side
}

export interface TransformerResult {
  turnsRatio: number; // n1/n2 = a
  secondaryVoltage?: number; // V2 = V1 / a  (ideal transformer, step relationship)
  reflectedImpedance?: number; // Z1' = a^2 * Z2 (impedance seen from primary)
}

export function analyzeIdealTransformer(input: TransformerInput): TransformerResult {
  const a = input.n1 / input.n2;
  const result: TransformerResult = { turnsRatio: a };
  if (input.primaryVoltage !== undefined) {
    result.secondaryVoltage = input.primaryVoltage / a;
  }
  if (input.secondaryLoadZ !== undefined) {
    result.reflectedImpedance = a * a * input.secondaryLoadZ;
  }
  return result;
}
