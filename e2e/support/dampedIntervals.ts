/**
 * Synthetic observations with two independently specified damped oscillations.
 * Frame and Time describe the same samples: Time = 5 * (Frame - 69).
 * Missing positions leave 279 and 536 observations in the tested intervals.
 * There is no random noise or dependence on private experimental data.
 */
const missingPositions = new Set([100, 101, 450, 451, 600, 750, 900]);
const csv = [
  "Frame,Position (m),Time (s)",
  ...Array.from({ length: 919 }, (_, index) => {
    const frame = index + 69;
    const [b, s, c, period, tau] =
      frame < 400 ? [0.625, 1.4, -0.4, 128, 240] : [-0.35, -0.9, 0.3, 160, 500];
    const phase = (2 * Math.PI * frame) / period;
    const position =
      b + Math.exp(-frame / tau) * (s * Math.sin(phase) + c * Math.cos(phase));
    return [
      frame,
      missingPositions.has(frame) ? "" : position,
      5 * (frame - 69),
    ].join(",");
  }),
].join("\n");

export const syntheticDampedIntervalsFile = {
  name: "synthetic-damped-intervals.csv",
  mimeType: "text/csv",
  buffer: Buffer.from(csv),
};
