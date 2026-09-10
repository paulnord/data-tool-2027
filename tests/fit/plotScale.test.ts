import { expect, it } from "vitest";
import {
  plotScale,
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
