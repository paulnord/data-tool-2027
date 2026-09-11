import { ticks as niceTicks, tickStep } from "d3-array";
export type GraphMode = "linear" | "log-x" | "log-y" | "log-log";
export const graphModes: Record<GraphMode, string> = {
  linear: "Linear (X linear, Y linear)",
  "log-x": "Semilog (X log, Y linear)",
  "log-y": "Semilog (X linear, Y log)",
  "log-log": "Log–log (X log, Y log)",
};

/** Display coordinates only: never transform observations used by the solver. */
export function plotScale(domain: [number, number], log: boolean) {
  const forward = (v: number) => (log ? Math.log10(v) : v);
  const inverse = (v: number) => (log ? 10 ** v : v);
  const lo = forward(domain[0]),
    hi = forward(domain[1]);
  return {
    fraction: (v: number) => (forward(v) - lo) / (hi - lo),
    value: (fraction: number) => inverse(lo + fraction * (hi - lo)),
    label: (value: number, count: number) =>
      tickLabel(value, log ? undefined : tickStep(domain[0], domain[1], count)),
    ticks: (count: number) => {
      if (!log) return niceTicks(lo, hi, count);
      if (log) {
        const ticks: number[] = [];
        const step = Math.max(1, Math.ceil((hi - lo) / (count - 1)));
        for (
          let exponent = Math.ceil(lo);
          exponent <= Math.floor(hi);
          exponent += step
        )
          ticks.push(10 ** exponent);
        if (ticks.length >= 2) return ticks;
      }
      return Array.from({ length: count }, (_, i) =>
        inverse(lo + (i * (hi - lo)) / (count - 1)),
      );
    },
  };
}

/** Fit the display to finite plotted values; zero is not an implicit datum. */
export function linearDomain(values: number[]): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];
  const lo = finite.reduce((a, b) => Math.min(a, b), Infinity);
  const hi = finite.reduce((a, b) => Math.max(a, b), -Infinity);
  const pad =
    lo === hi
      ? Math.abs(lo) * 0.01 || 1
      : Math.max(
          hi * 0.12 - lo * 0.12,
          Math.max(Math.abs(lo), Math.abs(hi)) * Number.EPSILON,
        );
  return [
    Math.max(-Number.MAX_VALUE, lo - pad),
    Math.min(Number.MAX_VALUE, hi + pad),
  ];
}

export function positiveDomain(
  values: number[],
  fallback: [number, number] = [1, 10],
): [number, number] {
  const positive = values.filter((v) => Number.isFinite(v) && v > 0);
  if (!positive.length) return fallback;
  const lo = positive.reduce((a, b) => Math.min(a, b), Infinity);
  const hi = positive.reduce((a, b) => Math.max(a, b), -Infinity);
  if (lo !== hi) return [lo, hi];
  return lo <= Number.MAX_VALUE / 10 ? [lo, lo * 10] : [lo / 10, lo];
}

export function plotPath(
  points: { x: number; y: number }[],
  x: (v: number) => number,
  y: (v: number) => number,
) {
  let connected = false;
  return points
    .map((p) => {
      const xx = x(p.x),
        yy = y(p.y);
      if (!Number.isFinite(xx) || !Number.isFinite(yy)) {
        connected = false;
        return "";
      }
      const command = `${connected ? "L" : "M"}${xx},${yy}`;
      connected = true;
      return command;
    })
    .join(" ");
}

export function tickLabel(v: number, step?: number): string {
  if (v === 0) return "0";
  const precision =
    step && Number.isFinite(step)
      ? Math.min(
          16,
          Math.max(
            1,
            Math.floor(Math.log10(Math.abs(v))) -
              Math.floor(Math.log10(Math.abs(step))) +
              1,
          ),
        )
      : 3;
  return Math.abs(v) < 0.01 || Math.abs(v) >= 1e5
    ? v.toExponential(Math.max(2, precision - 1))
    : Number(v.toPrecision(Math.max(4, precision))).toString();
}
