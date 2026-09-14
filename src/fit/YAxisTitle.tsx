/** A separate unit line keeps short residual panels legible at publication size. */
export function YAxisTitle({
  label,
  unit,
  x,
  y,
  splitUnit = false,
  fontSize = 12,
}: {
  label: string;
  unit: string | null;
  x: number;
  y: number;
  splitUnit?: boolean;
  fontSize?: number;
}) {
  return (
    <text
      className="fit-axis-label"
      data-axis-label="y"
      transform={`translate(${x} ${y}) rotate(-90)`}
      textAnchor="middle"
    >
      {splitUnit && unit ? (
        <>
          <tspan x={0}>{label}</tspan>
          <tspan x={0} dy={fontSize * 1.2}>{` [${unit}]`}</tspan>
        </>
      ) : (
        <>
          {label}
          {unit ? ` [${unit}]` : ""}
        </>
      )}
    </text>
  );
}
