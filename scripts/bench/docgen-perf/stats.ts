/** Statistics helpers for the per-engine docgen performance suite. */

/** Median of `values`. Throws on an empty input so a missing series fails loudly. */
export function median(values: number[]): number {
  if (values.length === 0) {
    throw new Error('median() requires at least one value');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Arithmetic mean of `values`. Throws on an empty input so a missing series fails loudly. */
export function mean(values: number[]): number {
  if (values.length === 0) {
    throw new Error('mean() requires at least one value');
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Least-squares slope of `values` vs index, in units-per-step. 0 for fewer than two points. */
export function leastSquaresSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}
