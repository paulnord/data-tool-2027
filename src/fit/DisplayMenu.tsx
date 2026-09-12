import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  appearanceColors,
  defaultPlotAppearance,
  PlotMarker,
  type PlotAppearance,
} from "./PlotAppearance";

export default function DisplayMenu({
  scale,
  onScale,
  appearance,
  onAppearance,
}: {
  scale: number;
  onScale: (scale: number) => void;
  appearance: PlotAppearance;
  onAppearance: (appearance: PlotAppearance) => void;
}) {
  const menu = useRef<HTMLDetailsElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState(0);
  const colors = appearanceColors(appearance);
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
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      if (!menu.current || !panel.current) return;
      const anchor = menu.current.getBoundingClientRect();
      const width = panel.current.getBoundingClientRect().width;
      const screenLeft = Math.max(
        12,
        Math.min(anchor.left, innerWidth - width - 12),
      );
      setLeft((screenLeft - anchor.left) / scale);
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [open, scale]);
  return (
    <details
      ref={menu}
      className="fit-display-menu"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        Display{" "}
        <span className="fit-menu-arrow" aria-hidden="true">
          ▾
        </span>
      </summary>
      <div ref={panel} className="fit-display-popover" style={{ left }}>
        <label>
          Interface size
          <select
            aria-label="Display size"
            value={scale}
            onChange={(event) => onScale(Number(event.target.value))}
          >
            <option value={1}>100%</option>
            <option value={1.25}>125%</option>
            <option value={1.5}>150%</option>
            <option value={2}>200%</option>
          </select>
        </label>
        <fieldset>
          <legend>Graph appearance</legend>
          <label>
            Colors
            <select
              value={appearance.palette}
              onChange={(event) =>
                onAppearance({
                  ...appearance,
                  palette: event.target.value as PlotAppearance["palette"],
                })
              }
            >
              <option value="color">Blue &amp; orange</option>
              <option value="muted">Green &amp; purple</option>
              <option value="mono">Black &amp; gray</option>
            </select>
          </label>
          <label>
            Marker size
            <select
              value={appearance.markerSize}
              onChange={(event) =>
                onAppearance({
                  ...appearance,
                  markerSize: event.target
                    .value as PlotAppearance["markerSize"],
                })
              }
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label>
            Marker style
            <select
              value={appearance.markerShape}
              onChange={(event) =>
                onAppearance({
                  ...appearance,
                  markerShape: event.target
                    .value as PlotAppearance["markerShape"],
                })
              }
            >
              <option value="circle">Circle</option>
              <option value="open-circle">Open circle</option>
              <option value="square">Square</option>
              <option value="diamond">Diamond</option>
              <option value="triangle">Triangle</option>
            </select>
          </label>
          <svg
            className="fit-appearance-sample"
            viewBox="0 0 220 28"
            aria-hidden="true"
          >
            <PlotMarker x={12} y={14} r={4} fill={colors[0]} />
            <text x={25} y={18}>
              Data
            </text>
            <line
              x1={110}
              y1={14}
              x2={135}
              y2={14}
              stroke={colors[1]}
              strokeWidth={2}
            />
            <text x={145} y={18}>
              Fit
            </text>
          </svg>
          <p>Applies to graphs, printing, and exports.</p>
          <button onClick={() => onAppearance(defaultPlotAppearance)}>
            Reset appearance
          </button>
        </fieldset>
      </div>
    </details>
  );
}
