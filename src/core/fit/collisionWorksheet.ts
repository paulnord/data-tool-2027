import { tableForAnalysis, type TableAnalysis } from "./dataTable";
import {
  collisionReport,
  type CollisionChannel,
  type CollisionConfig,
} from "./collision";

type Cell = string | number;

/** Stable, single-paste spreadsheet layout. No fit or uncertainty is recalculated. */
export function collisionWorksheet(
  channels: CollisionChannel[],
  source: TableAnalysis,
  config: CollisionConfig,
): string {
  if (channels.length !== 4)
    throw Error("Four fitted position channels are required.");
  const first = channels[0];
  if (first.before.interval[1] >= first.after.interval[0])
    throw Error(
      "Overlapping before/after intervals cannot have one Phase column.",
    );
  for (const channel of channels)
    for (const phase of ["before", "after"] as const) {
      const segment = channel[phase],
        reference = first[phase];
      if (
        JSON.stringify(segment.interval) !==
          JSON.stringify(reference.interval) ||
        JSON.stringify([...segment.settings.excludedIds].sort()) !==
          JSON.stringify([...reference.settings.excludedIds].sort())
      )
        throw Error(
          "A shared Phase column requires identical time selections for all four channels.",
        );
    }
  const rows: Cell[][] = [];
  const put = (row: number, column: number, values: Cell[]) => {
    rows[row] ??= [];
    values.forEach((value, i) => {
      rows[row][column + i] = value;
    });
  };
  const velocityUnit = (i: number) => {
    const d = channels[i].request.dataset;
    return `${d.yColumn.unit || "unspecified position unit"}/${d.xColumn.unit || "unspecified time unit"}`;
  };
  const axisUnit = (i: number) =>
    velocityUnit(i) === velocityUnit(i + 2)
      ? velocityUnit(i)
      : `Object 1: ${velocityUnit(i)}; Object 2: ${velocityUnit(i + 2)}`;
  put(0, 0, [
    "Object",
    "Phase",
    `vx (${axisUnit(0)})`,
    `σ(vx) (${axisUnit(0)})`,
    "R² x",
    `vy (${axisUnit(1)})`,
    `σ(vy) (${axisUnit(1)})`,
    "R² y",
  ]);
  let summaryRow = 1;
  for (const phase of ["before", "after"] as const)
    for (let object = 0; object < 2; object++) {
      const values = [0, 1].flatMap((axis) => {
        const r = channels[object * 2 + axis][phase].result;
        return [
          r?.coefficients[1] ?? "Unavailable",
          r?.standardErrors[1].value ?? "Unavailable",
          r?.rSquared.value ?? "Unavailable",
        ];
      });
      put(summaryRow++, 0, [
        `Object ${object + 1}`,
        phase === "before" ? "Before" : "After",
        ...values,
      ]);
    }
  const siUnits = channels.every(
    (c) =>
      c.request.dataset.xColumn.unit === "s" &&
      c.request.dataset.yColumn.unit === "m",
  );
  put(5, 0, [
    `${siUnits ? "" : "Unit warning: data are not all in metres and seconds. Match destination units before using these values. "}σ(v) is the fitted slope standard error; see each channel's uncertainty method. Phase is the shared time selection; missing/invalid positions are excluded independently for each axis. No unit conversion is applied.`,
  ]);
  const timeUnit = first.request.dataset.xColumn.unit || "unspecified";
  put(7, 0, [
    `Time (${timeUnit})`,
    ...channels.map(
      (c, i) =>
        `Object ${Math.floor(i / 2) + 1} ${i % 2 ? "y" : "x"} (${c.request.dataset.yColumn.unit || "unspecified"})`,
    ),
    "Phase",
  ]);
  const table = tableForAnalysis(source);
  const beforeExcluded = new Set(first.before.settings.excludedIds);
  const afterExcluded = new Set(first.after.settings.excludedIds);
  const timeRows = new Map(first.request.dataset.rows.map((r) => [r.id, r]));
  table.cells.slice(table.headerRows).forEach((row, i) => {
    const id = table.rowIds[table.headerRows + i];
    const time = timeRows.get(id)?.x;
    const phase =
      time == null
        ? "Exclude"
        : !beforeExcluded.has(id)
          ? "Before"
          : !afterExcluded.has(id)
            ? "After"
            : "Exclude";
    put(8 + i, 0, [
      row[config.time] ?? "",
      ...config.columns.map((c) => row[c] ?? ""),
      phase,
    ]);
  });
  put(0, 9, [
    "Object",
    "Axis",
    "Source column",
    "Position unit",
    "Uncertainty method",
    "Supplied position σ",
  ]);
  channels.forEach((c, i) => {
    const u = c.request.uncertainty;
    put(i + 1, 9, [
      `Object ${Math.floor(i / 2) + 1}`,
      i % 2 ? "y" : "x",
      c.request.dataset.yColumn.label,
      c.request.dataset.yColumn.unit || "unspecified",
      u.kind === "supplied-common"
        ? "Supplied position precision"
        : "Residual-based (estimated separately per interval)",
      u.kind === "supplied-common" ? u.sigmaY : "",
    ]);
  });
  put(6, 9, ["Phase", `From (${timeUnit})`, `To (${timeUnit})`]);
  put(7, 9, ["Before", ...first.before.interval]);
  put(8, 9, ["After", ...first.after.interval]);
  put(10, 9, ["Raw data rows", table.cells.length - table.headerRows]);
  put(11, 9, ["Format", "collision-worksheet-v1"]);
  put(12, 9, [
    "Selection",
    "Endpoints included; Exclude is outside both windows. Missing positions do not remove other components. See fit details for failed fits and unavailable statistics.",
  ]);
  collisionReport(channels)
    .split("\n")
    .forEach((line, i) => put(i, 16, line.split("\t")));
  const width = Math.max(...rows.map((r) => r?.length ?? 0));
  return Array.from({ length: rows.length }, (_, i) =>
    Array.from({ length: width }, (_, j) => {
      let value = String(rows[i]?.[j] ?? "");
      // Preserve numeric text, but do not execute imported labels/notes as formulas.
      if (/^[=+@-]/.test(value.trimStart()) && !Number.isFinite(Number(value)))
        value = `'${value}`;
      return /[\t\r\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join("\t"),
  ).join("\n");
}
