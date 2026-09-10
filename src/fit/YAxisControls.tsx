import { useEffect, useState } from "react";
import { plotScale } from "./plotScale";
import "./yAxisControls.css";

export type AxisRange = [number, number];
export function useYRange(key: string) {
  const [saved, setSaved] = useState<{ key: string; range: AxisRange | null }>({
    key,
    range: null,
  });
  return [
    saved.key === key ? saved.range : null,
    (range: AxisRange | null) => setSaved({ key, range }),
  ] as const;
}
export function YAxisControls({
  label,
  domain,
  custom,
  log = false,
  onChange,
}: {
  label: string;
  domain: AxisRange;
  custom: boolean;
  log?: boolean;
  onChange: (range: AxisRange | null) => void;
}) {
  const [draft, setDraft] = useState(["", ""]);
  const [error, setError] = useState("");
  useEffect(() => {
    setDraft(domain.map((v) => String(Number(v.toPrecision(12)))));
    setError("");
  }, [domain[0], domain[1]]);
  function zoom(factor: number) {
    const scale = plotScale(domain, log);
    const next: AxisRange = [
      scale.value(0.5 - factor / 2),
      scale.value(0.5 + factor / 2),
    ];
    if (
      next.every(Number.isFinite) &&
      next[0] < next[1] &&
      (!log || next[0] > 0)
    )
      onChange(next);
  }
  return (
    <details className="y-axis-controls">
      <summary aria-label={`${label} Y axis`}>
        Y axis · {custom ? "Custom" : "Auto"}
      </summary>
      <div className="y-axis-panel">
        <div className="y-axis-zoom">
          <button
            type="button"
            onClick={() => zoom(0.5)}
            aria-label={`${label} Zoom Y in`}
          >
            Zoom in
          </button>
          <button
            type="button"
            onClick={() => zoom(2)}
            aria-label={`${label} Zoom Y out`}
          >
            Zoom out
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(domain.map((v) => String(Number(v.toPrecision(12)))));
              onChange(null);
              setError("");
            }}
          >
            Auto
          </button>
        </div>
        {["Minimum", "Maximum"].map((name, i) => (
          <label key={name}>
            {name}
            <input
              type="number"
              step="any"
              aria-label={`${label} Y ${name.toLowerCase()}`}
              value={draft[i]}
              onChange={(e) =>
                setDraft((old) =>
                  old.map((v, j) => (j === i ? e.target.value : v)),
                )
              }
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => {
            const next = draft.map(Number) as AxisRange;
            if (
              draft.some((v) => !v.trim()) ||
              !next.every(Number.isFinite) ||
              next[0] >= next[1] ||
              (log && next[0] <= 0)
            ) {
              setError(
                log
                  ? "Enter positive limits with minimum below maximum."
                  : "Enter finite limits with minimum below maximum.",
              );
              return;
            }
            onChange(next);
            setError("");
          }}
        >
          Apply range
        </button>
        {error && <p role="alert">{error}</p>}
        <p>Display only; fitting still uses the selected observations.</p>
      </div>
    </details>
  );
}
