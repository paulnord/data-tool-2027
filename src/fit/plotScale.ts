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
    ticks: (count: number) => {
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

export const tickLabel = (v: number) =>
  v !== 0 && (Math.abs(v) < 0.01 || Math.abs(v) >= 1e5)
    ? v.toExponential(2)
    : Number(v.toPrecision(4)).toString();
