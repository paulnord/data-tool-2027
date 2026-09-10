import { draftRows, importData } from "./dataInput";
import { importRecords } from "./importGrid";
import {
  initialSettings,
  requestSchema,
  type DataTable,
  type FitRequest,
  type FitSettings,
} from "./schema";
/** CSV convention: a final, nonempty parenthesized suffix declares a unit.
 * No symbol lookup or numeric conversion; explicit metadata (including blank) wins.
 */
export function columnHeading(text: string, explicitUnit?: string) {
  const match = /^(.*?)\s+\(([^()]+)\)\s*$/.exec(text.trim());
  return {
    label: match?.[1]?.trim() || text.trim(),
    unit: explicitUnit ?? match?.[2]?.trim() ?? "",
  };
}
export type TableAnalysis = {
  request: FitRequest;
  settings: FitSettings;
  dataTable?: DataTable;
};
/** Older sessions reconstruct a table from their preserved analysis inputs. */
export function tableForAnalysis(analysis: TableAnalysis): DataTable {
  if (analysis.dataTable) return analysis.dataTable;
  const { request: r, settings: s } = analysis;
  const sigma =
    r.uncertainty.kind === "supplied-per-row" || !!s.retainedPerRowUncertainty;
  return {
    cells: [
      [
        r.dataset.xColumn.label,
        r.dataset.yColumn.label,
        ...(sigma ? ["Y uncertainty"] : []),
      ],
      ...draftRows(r, s).map((row) => [
        row.x,
        row.y,
        ...(sigma ? [row.sigma] : []),
      ]),
    ],
    rowIds: [`heading-${r.requestId}`, ...r.dataset.rows.map((row) => row.id)],
    headerRows: 1,
    x: 0,
    y: 1,
    sigma: sigma ? 2 : null,
    units: [
      r.dataset.xColumn.unit ?? "",
      r.dataset.yColumn.unit ?? "",
      r.dataset.yColumn.unit ?? "",
    ],
  };
}
/** Re-map stable rows, resetting model assumptions and Y noise when axes change. */
export function analysisFromTable(
  t: DataTable,
  source: string,
  base?: TableAnalysis,
  fileName?: string | null,
): TableAnalysis {
  const prior = base ? tableForAnalysis(base) : undefined;
  const axesSame = !!prior && prior.x === t.x && prior.y === t.y;
  const noiseSame = axesSame && prior!.sigma === t.sigma;
  const label = (column: number) =>
    t.headerRows
      ? t.cells[t.headerRows - 1]?.[column]?.trim() || `Column ${column + 1}`
      : `Column ${column + 1}`;
  t = {
    ...t,
    units: Array.from(
      { length: Math.max(...t.cells.map((row) => row.length), 0) },
      (_, i) => columnHeading(label(i), t.units[i]).unit,
    ),
  };
  const parsed = importData(
    importRecords(t.cells, t.headerRows),
    {
      header: t.headerRows > 0,
      x: t.x,
      y: t.y,
      sigma: t.sigma,
      label: source,
      xLabel: columnHeading(label(t.x)).label,
      yLabel: columnHeading(label(t.y)).label,
      xUnit: columnHeading(label(t.x), t.units[t.x]).unit,
      yUnit: columnHeading(label(t.y), t.units[t.y]).unit,
    },
    base?.request.requestId ?? "00000000-0000-4000-8000-000000000001",
    source,
    initialSettings("line"),
  );
  const oldRows = new Map(base?.request.dataset.rows.map((r) => [r.id, r]));
  const rows = parsed.dataset.rows.map((r, i) => {
    const id = t.rowIds[t.headerRows + i],
      old = oldRows.get(id);
    return {
      ...r,
      id,
      included:
        r.included &&
        (old?.missingReason != null || old === undefined || old.included),
    };
  });
  let uncertainty = parsed.uncertainty;
  if (uncertainty.kind === "supplied-per-row") {
    const sigmas = uncertainty.sigmaByRow;
    uncertainty = {
      ...uncertainty,
      sigmaByRow: Object.fromEntries(
        rows
          .map((r, i) => [r.id, sigmas[parsed.dataset.rows[i].id]])
          .filter(([, value]) => value !== undefined),
      ),
    };
    const original =
      base?.request.uncertainty.kind === "supplied-per-row"
        ? base.request.uncertainty
        : base?.settings.retainedPerRowUncertainty;
    if (noiseSame && original) {
      const changed = Object.entries(uncertainty.sigmaByRow).some(
        ([id, value]) => original.sigmaByRow[id] !== value,
      );
      uncertainty = {
        ...uncertainty,
        errorStructure: original.errorStructure,
        provenance: changed ? uncertainty.provenance : original.provenance,
      };
    }
  }
  const rowIds = new Set(rows.map((row) => row.id));
  let settings = axesSame
    ? {
        ...base!.settings,
        excludedIds: base!.settings.excludedIds.filter((id) => rowIds.has(id)),
      }
    : initialSettings("line");
  const retained =
    uncertainty.kind === "supplied-per-row" ? uncertainty : undefined;
  if (noiseSame && base!.request.uncertainty.kind !== "supplied-per-row")
    uncertainty = base!.request.uncertainty;
  settings = {
    ...settings,
    retainedPerRowUncertainty:
      noiseSame && base!.settings.retainedPerRowUncertainty
        ? retained
        : undefined,
  };
  const request = requestSchema.parse({
    ...parsed,
    source: base
      ? base.request.source
      : {
          ...parsed.source,
          fileName: fileName ?? null,
          context:
            [
              parsed.source.context,
              ...t.cells
                .slice(0, Math.max(0, t.headerRows - 1))
                .map((row) => row.join("\t")),
            ]
              .filter((line) => line != null && line !== "")
              .join("\n") || null,
        },
    dataset: {
      ...parsed.dataset,
      ...(base ? { id: base.request.dataset.id } : {}),
      assumptions: axesSame
        ? base!.request.dataset.assumptions
        : parsed.dataset.assumptions,
      rows,
    },
    uncertainty,
  });
  return { request, settings, dataTable: t };
}

/** Export the complete source table. Only the final heading is updated with current units.
 * Quote CSV punctuation without rounding numbers or coercing text into numeric values.
 */
export function tableCsv(table: DataTable): string {
  const rows = table.cells.map((row) => [...row]);
  if (table.headerRows > 0 && rows[table.headerRows - 1]) {
    rows[table.headerRows - 1] = rows[table.headerRows - 1].map((text, i) => {
      const { label, unit } = columnHeading(text, table.units[i]);
      return unit ? `${label} (${unit})` : label;
    });
  } else if (table.units.some((unit) => unit.trim())) {
    const width = Math.max(0, ...rows.map((row) => row.length));
    rows.unshift(
      Array.from({ length: width }, (_, i) =>
        table.units[i]?.trim()
          ? `Column ${i + 1} (${table.units[i].trim()})`
          : `Column ${i + 1}`,
      ),
    );
  }
  const quote = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '\"\"')}"` : value;
  return (
    rows.map((row) => row.map(quote).join(",")).join("\r\n") +
    (rows.length ? "\r\n" : "")
  );
}

/** Insert an empty source column, keeping assignments attached to their data. */
export function insertTableColumn(table: DataTable, index: number): DataTable {
  const width = Math.max(0, ...table.cells.map((row) => row.length));
  if (!Number.isInteger(index) || index < 0 || index > width || width >= 1000)
    throw new Error(
      "Choose an existing column edge; tables support up to 1,000 columns",
    );
  const shift = (column: number) => (column >= index ? column + 1 : column);
  const units = Array.from({ length: width }, (_, i) => table.units[i] ?? "");
  units.splice(index, 0, "");
  return {
    ...table,
    cells: table.cells.map((row) => {
      const next = Array.from(
        { length: Math.max(row.length, index) },
        (_, i) => row[i] ?? "",
      );
      next.splice(index, 0, "");
      return next;
    }),
    units,
    x: shift(table.x),
    y: shift(table.y),
    sigma: table.sigma === null ? null : shift(table.sigma),
  };
}
