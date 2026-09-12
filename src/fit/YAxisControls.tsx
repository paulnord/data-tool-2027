import { useEffect, useRef, useState } from "react";
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
type AxisControlsProps = {
  axis: "X" | "Y";
  label: string;
  domain: AxisRange;
  custom: boolean;
  log?: boolean;
  onLogChange?: (log: boolean) => void;
  onChange: (range: AxisRange | null) => void;
};

export function YAxisControls(props: Omit<AxisControlsProps, "axis">) {
  return <AxisControls {...props} axis="Y" />;
}

export function AxisControls({
  axis,
  label,
  domain,
  custom,
  log = false,
  onLogChange,
  onChange,
}: AxisControlsProps) {
  const menu = useRef<HTMLDetailsElement>(null);
  const [draft, setDraft] = useState(["", ""]);
  const [error, setError] = useState("");
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target))
        menu.current?.removeAttribute("open");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !menu.current?.open) return;
      event.preventDefault();
      menu.current.removeAttribute("open");
      menu.current.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    setDraft(domain.map((v) => String(Number(v.toPrecision(12)))));
    setError("");
  }, [domain[0], domain[1], log]);
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
    <details ref={menu} className="y-axis-controls">
      <summary
        aria-label={`${label} ${axis} axis`}
        onClick={() => {
          for (const other of document.querySelectorAll(
            ".y-axis-controls[open]",
          )) {
            if (other !== menu.current) other.removeAttribute("open");
          }
        }}
      >
        {axis} axis · {custom ? "Custom" : "Auto"}
      </summary>
      <div className="y-axis-panel">
        {onLogChange && (
          <label className="axis-log-control">
            <input
              type="checkbox"
              aria-label={`Log ${axis}`}
              checked={log}
              onChange={(event) => onLogChange(event.target.checked)}
            />
            Logarithmic scale
          </label>
        )}
        <div className="y-axis-zoom">
          <button
            type="button"
            onClick={() => zoom(0.5)}
            aria-label={`${label} Zoom ${axis} in`}
          >
            Zoom in
          </button>
          <button
            type="button"
            onClick={() => zoom(2)}
            aria-label={`${label} Zoom ${axis} out`}
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
              aria-label={`${label} ${axis} ${name.toLowerCase()}`}
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
