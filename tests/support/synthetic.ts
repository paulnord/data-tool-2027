import type { FitRequest } from "../../src/core/fit/schema";
/** Mulberry32 + Box-Muller v1, deterministic demonstration/test noise, not measurement data. */
export function gaussianGenerator(seed: number) {
  let state = seed >>> 0;
  const uniform = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () =>
    Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
}
export function syntheticRequest(seed = 2027): FitRequest {
  const normal = gaussianGenerator(seed);
  return {
    format: "tracker-fit-request",
    version: 1,
    requestId: "e7c00000-0000-4000-8000-000000000001",
    snapshotId: "e7c00000-0000-4000-8000-000000000002",
    source: {
      application: "Synthetic fixture",
      version: "mulberry32-boxmuller-1",
      context: `seed=${seed}; y=2+10t-4.905t²; sigma=0.02 m; independent Gaussian noise`,
    },
    dataset: {
      id: "ballistic-demo",
      label: "Ball toss · synthetic experiment",
      xColumn: { id: "t", label: "Time", unit: "s" },
      yColumn: { id: "y", label: "Height", unit: "m" },
      assumptions: {
        exactX: "asserted",
        gaussianIndependent: "asserted",
        correctModel: "asserted",
      },
      rows: Array.from({ length: 61 }, (_, i) => {
        const x = (2 * i) / 60;
        return {
          id: `row-${i}`,
          x,
          y: 2 + 10 * x - 4.905 * x * x + 0.02 * normal(),
          included: true,
          missingReason: null,
        };
      }),
    },
    uncertainty: {
      kind: "supplied-common",
      sigmaY: 0.02,
      errorStructure: "uncorrelated",
      provenance: {
        kind: "user-asserted",
        description: "Known generating standard deviation, not instrument data",
      },
    },
  };
}
