import { expect, it } from "vitest";
import {
  plotScale,
  linearDomain,
  positiveDomain,
  plotPath,
  tickLabel,
} from "../../src/fit/plotScale";
it("spaces decades equally and inverts selection coordinates in original units", () => {
  const scale = plotScale([0.01, 100], true);
  expect([0.01, 0.1, 1, 10, 100].map(scale.fraction)).toEqual([
    0, 0.25, 0.5, 0.75, 1,
  ]);
  expect(scale.value(0.75)).toBe(10);
  expect(scale.ticks(5)).toEqual([0.01, 0.1, 1, 10, 100]);
  expect(plotScale([-10, 10], false).value(0.25)).toBe(-5);
});
it("handles empty, nonpositive and constant positive domains without changing observations", () => {
  const values = [-1, 0, 0.001, 0.001];
  expect(positiveDomain(values)).toEqual([0.001, 0.01]);
  expect(values).toEqual([-1, 0, 0.001, 0.001]);
  expect(positiveDomain([-1, 0])).toEqual([1, 10]);
  expect(positiveDomain([Number.MAX_VALUE]).every(Number.isFinite)).toBe(true);
  expect(tickLabel(1e-8)).toBe("1.00e-8");
});
it("breaks curves at unrepresentable points rather than joining across log-domain gaps", () => {
  const d = plotPath(
    [
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 10 },
      { x: 4, y: 100 },
    ],
    (x) => x,
    Math.log10,
  );
  expect(d).toBe("M1,0  M3,1 L4,2");
  expect(d).not.toMatch(/NaN|Infinity/);
});

it("chooses clean linear ticks inside exact view limits", () => {
  expect(plotScale([-4.306, 1.729], false).ticks(6)).toEqual([
    -4, -3, -2, -1, 0, 1,
  ]);
  expect(plotScale([-4.5, 8.5], false).ticks(6)).toEqual([
    -4, -2, 0, 2, 4, 6, 8,
  ]);
  expect(plotScale([0.11, 0.39], false).ticks(6)).toEqual([
    0.15, 0.2, 0.25, 0.3, 0.35,
  ]);
  const scale = plotScale([1000000, 1000000.006], false);
  const labels = scale.ticks(6).map((v) => scale.label(v, 6));
  expect(new Set(labels).size).toBe(labels.length);
});

it("automatic linear limits follow the data spread, not zero or the absolute offset", () => {
  const range = linearDomain([54216.37, 54526.74]);
  expect(range[0]).toBeCloseTo(54179.1256);
  expect(range[1]).toBeCloseTo(54563.9844);
  expect(plotScale(range, false).ticks(6)).toEqual([
    54200, 54250, 54300, 54350, 54400, 54450, 54500, 54550,
  ]);
  expect(linearDomain([-54526.74, -54216.37])).toEqual([-range[1], -range[0]]);
  const small = linearDomain([0.002, 0.003]);
  expect(small[0]).toBeGreaterThan(0);
  expect(small[1]).toBeLessThan(0.004);
  expect(linearDomain([-2, 3])[0]).toBeLessThan(0);
});
it("automatic linear limits handle empty and constant plots", () => {
  expect(linearDomain([NaN, Infinity])).toEqual([0, 1]);
  for (const value of [0, 54200, -54200, 1e-12]) {
    const [lo, hi] = linearDomain([value, value]);
    expect(lo).toBeLessThan(value);
    expect(hi).toBeGreaterThan(value);
    expect([lo, hi].every(Number.isFinite)).toBe(true);
  }
});
