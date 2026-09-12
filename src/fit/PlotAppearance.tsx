import {
  createContext,
  useContext,
  type CSSProperties,
  type SVGAttributes,
} from "react";

export type PlotAppearance = {
  palette: "color" | "muted" | "mono";
  markerSize: "small" | "medium" | "large";
  markerShape: "circle" | "open-circle" | "square" | "diamond" | "triangle";
};

export const defaultPlotAppearance: PlotAppearance = {
  palette: "color",
  markerSize: "medium",
  markerShape: "circle",
};

export const PlotAppearanceContext = createContext(defaultPlotAppearance);

export const usePlotAppearance = () => useContext(PlotAppearanceContext);

const palettes = {
  color: ["#2875a4", "#b45b20", "#7854a0", "#187a68", "#a03856"],
  muted: ["#4f7865", "#806287", "#a07a42", "#3d7985", "#965c70"],
  mono: ["#222222", "#555555", "#777777", "#3d3d3d", "#666666"],
};

export function appearanceColors(appearance: PlotAppearance): string[] {
  return palettes[appearance.palette];
}

export function appearanceStyle(appearance: PlotAppearance): CSSProperties {
  const colors = appearanceColors(appearance);
  return {
    "--plot-data-color": colors[0],
    "--plot-fit-color": colors[1],
    "--plot-outside-color":
      appearance.palette === "mono" ? "#999999" : "#9baab6",
  } as CSSProperties;
}

type PlotMarkerProps = Omit<SVGAttributes<SVGElement>, "x" | "y"> & {
  x: number;
  y: number;
  r: number;
};

// Keep every shape at the same observation coordinates, with the same event
// handlers and row identity. Appearance never changes the observations.
export function PlotMarker({ x, y, r, ...props }: PlotMarkerProps) {
  const appearance = usePlotAppearance();
  const radius =
    r * { small: 0.7, medium: 1, large: 1.4 }[appearance.markerSize];
  const markerProps = {
    ...props,
    "data-marker-shape": appearance.markerShape,
  };
  switch (appearance.markerShape) {
    case "open-circle":
      return (
        <circle
          {...markerProps}
          cx={x}
          cy={y}
          r={radius}
          style={{
            ...props.style,
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.3,
          }}
        />
      );
    case "square":
      return (
        <rect
          {...markerProps}
          x={x - radius}
          y={y - radius}
          width={radius * 2}
          height={radius * 2}
        />
      );
    case "diamond":
      return (
        <path
          {...markerProps}
          d={`M${x},${y - radius * 1.25} L${x + radius * 1.25},${y} L${x},${y + radius * 1.25} L${x - radius * 1.25},${y} Z`}
        />
      );
    case "triangle":
      return (
        <path
          {...markerProps}
          d={`M${x},${y - radius * 1.3} L${x + radius * 1.13},${y + radius * 0.65} L${x - radius * 1.13},${y + radius * 0.65} Z`}
        />
      );
    default:
      return <circle {...markerProps} cx={x} cy={y} r={radius} />;
  }
}
