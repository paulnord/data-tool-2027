import { tableForAnalysis, type TableAnalysis } from "./dataTable";
import { type CollisionChannel, type CollisionConfig } from "./collision";
import { statisticReasonText } from "./diagnosticText";

type Cell = string | number;
function tsv(rows: Cell[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let value = String(cell);
          // Keep numeric text intact; never execute imported labels as formulas.
          if (
            /^[=+@-]/.test(value.trimStart()) &&
            !Number.isFinite(Number(value))
          )
            value = `'${value}`;
          return /[\t\r\n"]/.test(value)
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join("\t"),
    )
    .join("\n");
}
function fourChannels(channels: CollisionChannel[]) {
  if (channels.length !== 4)
    throw Error("Four fitted position channels are required.");
}
const unit = (value: string | null | undefined) => value || "unspecified";

/** Original positions plus actual shared selection. Missing axes stay independent. */
export function collisionPositions(
  channels: CollisionChannel[],
  source: TableAnalysis,
  config: CollisionConfig,
): string {
  fourChannels(channels);
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
  const rows: Cell[][] = [
    [
      `Time (${unit(first.request.dataset.xColumn.unit)})`,
      ...channels.map(
        (c, i) =>
          `Object ${Math.floor(i / 2) + 1} ${i % 2 ? "y" : "x"} (${unit(c.request.dataset.yColumn.unit)})`,
      ),
      "Phase",
    ],
  ];
  const table = tableForAnalysis(source);
  const beforeExcluded = new Set(first.before.settings.excludedIds),
    afterExcluded = new Set(first.after.settings.excludedIds);
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
    rows.push([
      row[config.time] ?? "",
      ...config.columns.map((c) => row[c] ?? ""),
      phase,
    ]);
  });
  return tsv(rows);
}

/** One row per fit, with full-precision coefficients and truthful units/uncertainty. */
export function collisionFitTable(channels: CollisionChannel[]): string {
  fourChannels(channels);
  const positions = channels.map((c) => unit(c.request.dataset.yColumn.unit));
  const times = channels.map((c) => unit(c.request.dataset.xColumn.unit));
  const mixed = new Set(positions).size > 1 || new Set(times).size > 1;
  const positionUnit = mixed ? "source units" : positions[0];
  const timeUnit = mixed ? "source units" : times[0];
  const velocityUnit = mixed ? "source units" : `${positionUnit}/${timeUnit}`;
  const rows: Cell[][] = [
    [
      "Object",
      "Phase",
      "Axis",
      "N",
      `Velocity (${velocityUnit})`,
      `Velocity σ (${velocityUnit})`,
      `Intercept (${positionUnit})`,
      "R²",
      `From (${timeUnit})`,
      `To (${timeUnit})`,
      "Uncertainty method",
      `Position σ (${positionUnit})`,
      "Source column",
      "Notes",
      ...(mixed ? ["Velocity unit", "Position unit", "Time unit"] : []),
    ],
  ];
  for (const phase of ["before", "after"] as const)
    channels.forEach((channel, i) => {
      const segment = channel[phase],
        r = segment.result,
        u = channel.request.uncertainty;
      const reasons = [
        segment.error,
        ...(r?.warnings ?? []),
        r?.standardErrors[1].reason
          ? statisticReasonText(r.standardErrors[1].reason)
          : null,
        r?.rSquared.reason ? statisticReasonText(r.rSquared.reason) : null,
      ]
        .filter(Boolean)
        .join(" ");
      rows.push([
        `Object ${Math.floor(i / 2) + 1}`,
        phase === "before" ? "Before" : "After",
        i % 2 ? "y" : "x",
        r?.n ?? "Unavailable",
        r?.coefficients[1] ?? "Unavailable",
        r?.standardErrors[1].value ?? "Unavailable",
        r?.coefficients[0] ?? "Unavailable",
        r?.rSquared.value ?? "Unavailable",
        ...segment.interval,
        u.kind === "supplied-common"
          ? "Supplied position precision"
          : "Residual-based",
        u.kind === "supplied-common" ? u.sigmaY : "Not supplied",
        channel.request.dataset.yColumn.label,
        reasons,
        ...(mixed
          ? [`${positions[i]}/${times[i]}`, positions[i], times[i]]
          : []),
      ]);
    });
  return tsv(rows);
}
