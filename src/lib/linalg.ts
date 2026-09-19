import { type Complex, sub, mul, div, C, ZERO, mag } from "./complex";

/** Solve A x = b for complex square A (n x n) and b (n), via Gaussian
 * elimination with partial pivoting (by magnitude). Returns null if the
 * matrix is singular (e.g. a floating node, or a shorted voltage-source loop). */
export function solveComplexLinearSystem(
  aIn: Complex[][],
  bIn: Complex[]
): Complex[] | null {
  const n = bIn.length;
  if (n === 0) return [];
  // Deep-copy so callers keep their original matrix.
  const a: Complex[][] = aIn.map((row) => row.map((v) => ({ ...v })));
  const b: Complex[] = bIn.map((v) => ({ ...v }));

  for (let col = 0; col < n; col++) {
    // Partial pivot: find the row with the largest magnitude in this column.
    let pivotRow = col;
    let pivotMag = mag(a[col][col]);
    for (let r = col + 1; r < n; r++) {
      const m = mag(a[r][col]);
      if (m > pivotMag) {
        pivotMag = m;
        pivotRow = r;
      }
    }
    if (pivotMag < 1e-12) return null; // singular

    if (pivotRow !== col) {
      [a[col], a[pivotRow]] = [a[pivotRow], a[col]];
      [b[col], b[pivotRow]] = [b[pivotRow], b[col]];
    }

    const pivot = a[col][col];
    for (let r = col + 1; r < n; r++) {
      if (mag(a[r][col]) === 0) continue;
      const factor = div(a[r][col], pivot);
      for (let c = col; c < n; c++) {
        a[r][c] = sub(a[r][c], mul(factor, a[col][c]));
      }
      b[r] = sub(b[r], mul(factor, b[col]));
    }
  }

  // Back-substitution.
  const x: Complex[] = new Array(n).fill(ZERO).map(() => C(0, 0));
  for (let row = n - 1; row >= 0; row--) {
    let sum = b[row];
    for (let c = row + 1; c < n; c++) {
      sum = sub(sum, mul(a[row][c], x[c]));
    }
    x[row] = div(sum, a[row][row]);
  }
  return x;
}
