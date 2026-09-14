export type GuideLabel = {
  text: string;
  id?: string;
  description: string;
  color: string;
  intervalIndex?: number;
  candidateIndex?: number;
};

/** Reserve rows above the frame, so guide labels never cover observations. */
export function layoutGuideLabels(
  labels: GuideLabel[],
  width: number,
  fontSize: number,
) {
  const rowHeight = fontSize * 1.6;
  let x = 0,
    row = 0,
    minimumWidth = 0;
  const entries = labels.map((label) => {
    const labelWidth = label.text.length * fontSize * 0.66 + fontSize * 2.8;
    minimumWidth = Math.max(minimumWidth, labelWidth);
    if (x > 0 && x + labelWidth > width) {
      row++;
      x = 0;
    }
    const entry = { ...label, x, y: row * rowHeight + fontSize };
    x += labelWidth;
    return entry;
  });
  return {
    entries,
    minimumWidth,
    height: labels.length ? (row + 1) * rowHeight + fontSize * 0.25 : 0,
  };
}

export function FitGuideLegend({
  layout,
  left,
  top,
  fontSize,
}: {
  layout: ReturnType<typeof layoutGuideLabels>;
  left: number;
  top: number;
  fontSize: number;
}) {
  if (!layout.entries.length) return null;
  return (
    <g aria-label="Fit guide labels" style={{ pointerEvents: "none" }}>
      {layout.entries.map((entry, i) => (
        <g key={i} transform={`translate(${left + entry.x}, ${top + entry.y})`}>
          <title>{entry.description}</title>
          <line
            x1={0}
            x2={fontSize * 1.4}
            y1={-fontSize * 0.3}
            y2={-fontSize * 0.3}
            stroke={entry.color}
            strokeWidth={1}
            strokeDasharray="2 3"
          />
          <text
            data-guide-label={entry.id ?? "baseline"}
            data-mean-position-label={
              !entry.id || entry.id === "baseline" ? "true" : undefined
            }
            data-interval-index={entry.intervalIndex}
            data-candidate-index={entry.candidateIndex}
            x={fontSize * 1.8}
            y={0}
            style={{ fill: entry.color, fontSize }}
          >
            {entry.text}
          </text>
        </g>
      ))}
    </g>
  );
}
