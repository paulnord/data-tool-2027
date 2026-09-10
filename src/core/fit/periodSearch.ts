/** Profiled sine search: sample frequency at >=16 steps per observed cycle,
 * then refine every detected local minimum by golden-section minimization.
 * This bounded search reports competing minima; it is not a proof of a global
 * optimum for arbitrary undersampled data. Work limits fail explicitly.
 */
export function searchPeriod(
  min: number,
  max: number,
  span: number,
  objective: (period: number) => number,
) {
  if (!(min > 0 && max > min && span > 0) || !Number.isFinite(min + max + span))
    throw Error(
      "Period search requires 0 < minimum < maximum and a nonzero x span",
    );
  const lo = 1 / max,
    hi = 1 / min;
  const count = Math.max(128, Math.ceil(16 * span * (hi - lo)));
  if (count > 4096)
    throw Error(
      "Period search range is too broad; increase the minimum period or narrow the range",
    );
  const sample = (frequency: number) => ({
    frequency,
    value: objective(1 / frequency),
  });
  const grid = Array.from({ length: count + 1 }, (_, i) =>
    sample(lo + ((hi - lo) * i) / count),
  );
  const candidates = [grid[0], grid[count]];
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let i = 1; i < count; i++) {
    if (
      !Number.isFinite(grid[i].value) ||
      grid[i].value > grid[i - 1].value ||
      grid[i].value > grid[i + 1].value
    )
      continue;
    let a = grid[i - 1].frequency,
      b = grid[i + 1].frequency;
    let c = sample(b - ratio * (b - a)),
      d = sample(a + ratio * (b - a));
    for (let iteration = 0; iteration < 70; iteration++) {
      if (c.value < d.value) {
        b = d.frequency;
        d = c;
        c = sample(b - ratio * (b - a));
      } else {
        a = c.frequency;
        c = d;
        d = sample(a + ratio * (b - a));
      }
    }
    candidates.push(c.value < d.value ? c : d);
  }
  candidates.sort((a, b) => a.value - b.value);
  const best = candidates[0];
  if (!Number.isFinite(best.value))
    throw Error("No identifiable sine fit in the period range");
  return {
    period: 1 / best.frequency,
    boundary: best.frequency === lo || best.frequency === hi,
    competing: candidates
      .filter((c) => Math.abs(c.frequency - best.frequency) * span > 0.25)
      .map((c) => ({ period: 1 / c.frequency, objective: c.value })),
  };
}
