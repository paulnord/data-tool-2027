export const RANK_TOLERANCE = 1e-12;
const dot = (a: number[], b: number[]) =>
  a.reduce((s, v, i) => s + v * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));
/** Column-pivoted, twice-reorthogonalized modified Gram-Schmidt QR.
 * Columns are normalized before factorization. The small (<=8 column) R
 * factor is solved by substitution; normal equations are never formed.
 * Rank threshold is relative to the largest normalized R diagonal.
 */
export function qr(columns: number[][], response: number[]) {
  const p = columns.length,
    scales = columns.map(norm),
    order = columns.map((_, i) => i);
  const work = columns.map((c, j) => c.map((v) => v / (scales[j] || 1))),
    q: number[][] = [];
  const r = Array.from({ length: p }, () => Array(p).fill(0) as number[]);
  for (let k = 0; k < p; k++) {
    let pivot = k;
    for (let j = k + 1; j < p; j++)
      if (norm(work[j]) > norm(work[pivot])) pivot = j;
    [work[k], work[pivot]] = [work[pivot], work[k]];
    [order[k], order[pivot]] = [order[pivot], order[k]];
    for (let i = 0; i < k; i++) [r[i][k], r[i][pivot]] = [r[i][pivot], r[i][k]];
    r[k][k] = norm(work[k]);
    if (!Number.isFinite(r[k][k]) || r[k][k] <= RANK_TOLERANCE)
      throw Error(
        `Rank deficient: ${k} independent columns for ${p} free parameters`,
      );
    q[k] = work[k].map((v) => v / r[k][k]);
    for (let j = k + 1; j < p; j++)
      for (let pass = 0; pass < 2; pass++) {
        const projection = dot(q[k], work[j]);
        r[k][j] += projection;
        work[j] = work[j].map((v, i) => v - projection * q[k][i]);
      }
  }
  function back(b: number[]) {
    const out = Array(p).fill(0) as number[];
    for (let i = p - 1; i >= 0; i--) {
      let v = b[i];
      for (let j = i + 1; j < p; j++) v -= r[i][j] * out[j];
      out[i] = v / r[i][i];
    }
    return out;
  }
  const pivoted = back(q.map((c) => dot(c, response))),
    coefficients = Array(p).fill(0) as number[];
  pivoted.forEach((v, i) => (coefficients[order[i]] = v / scales[order[i]]));
  const inverseColumns = Array.from({ length: p }, (_, j) =>
    back(Array.from({ length: p }, (_, i) => (i === j ? 1 : 0))),
  );
  const covariance = Array.from(
    { length: p },
    () => Array(p).fill(0) as number[],
  );
  for (let i = 0; i < p; i++)
    for (let j = 0; j < p; j++)
      covariance[order[i]][order[j]] =
        inverseColumns.reduce((s, c) => s + c[i] * c[j], 0) /
        (scales[order[i]] * scales[order[j]]);
  return {
    coefficients,
    covariance,
    diagonalRatio: p
      ? Math.max(...r.map((v, i) => v[i])) / Math.min(...r.map((v, i) => v[i]))
      : 1,
  };
}
