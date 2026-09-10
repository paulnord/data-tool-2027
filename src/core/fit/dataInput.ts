import { numericCell } from "./schema";
export { numericCell } from "./schema";
import { requestSchema, type FitRequest, type FitSettings } from "./schema";

/** CSV/TSV records, including quoted delimiters, escaped quotes and newlines.
 * Empty fields are preserved; only a final record terminator is ignored. */
export function parseDelimited(
  text: string,
  delimiter: "," | "\t",
): string[][] {
  if (text.length > 20_000_000) throw new Error("Input exceeds 20 MB limit");
  text = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  const field = () => {
    row.push(cell);
    if (row.length > 1000) throw new Error("Too many rows or columns");
    cell = "";
    closed = false;
  };
  const record = () => {
    field();
    rows.push(row);
    if (rows.length > 100001) throw new Error("Too many rows or columns");
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === delimiter) {
      field();
    } else if (c === "\n" || c === "\r") {
      record();
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else if (c === '"' && cell === "" && !closed) quoted = true;
    else {
      if (closed || c === '"')
        throw new Error(`Malformed quote at character ${i + 1}`);
      cell += c;
    }
  }
  if (quoted) throw new Error("Unclosed quoted field");
  if (cell !== "" || row.length || closed) {
    record();
  }
  if (!rows.length) throw new Error("No data to import");
  return rows;
}

export type DataRowDraft = { id: string; x: string; y: string; sigma: string };
export type ColumnMapping = {
  header: boolean;
  x: number;
  y: number;
  sigma: number | null;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  label: string;
};
export function mappedRows(
  records: string[][],
  mapping: ColumnMapping,
): DataRowDraft[] {
  if (
    mapping.x === mapping.y ||
    mapping.sigma === mapping.x ||
    mapping.sigma === mapping.y
  )
    throw new Error("Choose distinct x, y and uncertainty columns");
  const width = records[0].length;
  for (const column of [mapping.x, mapping.y, mapping.sigma])
    if (
      column !== null &&
      (!Number.isInteger(column) || column < 0 || column >= width)
    )
      throw new Error("Choose an available column");
  return records.slice(mapping.header ? 1 : 0).map((r, i) => {
    if (r.length !== width)
      throw new Error(
        `Record ${i + (mapping.header ? 2 : 1)} has ${r.length} columns; expected ${width}`,
      );
    return {
      id: `row-${i + 1}`,
      x: r[mapping.x],
      y: r[mapping.y],
      sigma: mapping.sigma === null ? "" : r[mapping.sigma],
    };
  });
}
export function draftRows(
  request: FitRequest,
  settings: FitSettings,
): DataRowDraft[] {
  const perRow =
    request.uncertainty.kind === "supplied-per-row"
      ? request.uncertainty
      : settings.retainedPerRowUncertainty;
  return request.dataset.rows.map((r) => ({
    id: r.id,
    x: r.x === null ? "" : String(r.x),
    y: r.y === null ? "" : String(r.y),
    sigma:
      perRow?.sigmaByRow[r.id] === undefined
        ? ""
        : String(perRow.sigmaByRow[r.id]),
  }));
}
/** Apply a rectangular paste atomically. Never truncate overflow or create rows implicitly. */
export function pasteCells(
  rows: DataRowDraft[],
  start: number,
  column: number,
  cells: string[][],
  columns: number,
): DataRowDraft[] {
  if (
    start < 0 ||
    column < 0 ||
    start + cells.length > rows.length ||
    cells.some((r) => column + r.length > columns)
  )
    throw new Error(
      "Paste exceeds the table. Add rows first or choose an earlier cell.",
    );
  const keys = ["x", "y", "sigma"] as const;
  return rows.map((r, i) =>
    i < start || i >= start + cells.length
      ? r
      : {
          ...r,
          ...Object.fromEntries(
            cells[i - start].map((v, j) => [keys[column + j], v]),
          ),
        },
  );
}
export function editData(
  request: FitRequest,
  settings: FitSettings,
  drafts: DataRowDraft[],
  mapping?: ColumnMapping,
): { request: FitRequest; settings: FitSettings } {
  const perRow =
    request.uncertainty.kind === "supplied-per-row"
      ? request.uncertainty
      : settings.retainedPerRowUncertainty;
  const sigmaByRow: Record<string, number> = Object.create(null);
  const previous = new Map(request.dataset.rows.map((r) => [r.id, r]));
  const rows = drafts.map((r) => {
    try {
      const x = numericCell(r.x),
        y = numericCell(r.y),
        sigma = numericCell(r.sigma);
      if (
        perRow &&
        ((sigma === null && x !== null && y !== null) ||
          (sigma !== null && sigma <= 0))
      )
        throw new Error("Supply a positive σy for this row");
      if (perRow && sigma !== null) sigmaByRow[r.id] = sigma;
      const old = previous.get(r.id);
      return {
        id: r.id,
        x,
        y,
        included:
          x !== null &&
          y !== null &&
          (old?.missingReason != null || old === undefined || old.included),
        missingReason:
          x === null || y === null
            ? (old?.missingReason ?? ("missing-value" as const))
            : null,
      };
    } catch (error) {
      throw new Error(`${r.id}: ${(error as Error).message}`);
    }
  });
  const retained = perRow
    ? {
        ...perRow,
        sigmaByRow,
        provenance: Object.entries(sigmaByRow).some(
          ([id, value]) => perRow.sigmaByRow[id] !== value,
        )
          ? {
              kind: "user-asserted" as const,
              description:
                "User-supplied absolute y standard deviations; original input is preserved separately when edited.",
            }
          : perRow.provenance,
      }
    : undefined;
  const ids = new Set(rows.map((r) => r.id));
  const dataset = {
    ...request.dataset,
    rows,
    ...(mapping
      ? {
          label: mapping.label.trim(),
          xColumn: {
            ...request.dataset.xColumn,
            label: mapping.xLabel.trim(),
            unit: mapping.xUnit.trim() || null,
          },
          yColumn: {
            ...request.dataset.yColumn,
            label: mapping.yLabel.trim(),
            unit: mapping.yUnit.trim() || null,
          },
        }
      : {}),
  };
  return {
    request: requestSchema.parse({
      ...request,
      dataset,
      uncertainty:
        request.uncertainty.kind === "supplied-per-row"
          ? retained
          : request.uncertainty,
    }),
    settings: {
      ...settings,
      excludedIds: settings.excludedIds.filter((id) => ids.has(id)),
      ...(settings.retainedPerRowUncertainty
        ? { retainedPerRowUncertainty: retained }
        : {}),
    },
  };
}
export function importData(
  records: string[][],
  mapping: ColumnMapping,
  id: string,
  source: string,
  settings: FitSettings,
): FitRequest {
  const request: FitRequest = {
    format: "tracker-fit-request",
    version: 1,
    requestId: id,
    snapshotId: id,
    source: {
      application: "Delimited data import",
      version: "1",
      context: source,
    },
    dataset: {
      id,
      label: mapping.label,
      xColumn: { id: "x", label: mapping.xLabel, unit: null },
      yColumn: { id: "y", label: mapping.yLabel, unit: null },
      rows: [],
      assumptions: {
        exactX: "unknown",
        gaussianIndependent: "unknown",
        correctModel: "unknown",
      },
    },
    uncertainty:
      mapping.sigma === null
        ? { kind: "unknown-equal", errorStructure: "unknown" }
        : {
            kind: "supplied-per-row",
            errorStructure: "unknown",
            sigmaByRow: {},
            provenance: {
              kind: "user-asserted",
              description: `Column ${mapping.sigma + 1} supplied as absolute y standard deviations from ${source}`,
            },
          },
  };
  return editData(request, settings, mappedRows(records, mapping), mapping)
    .request;
}

/** Presentation suggestions only. The user reviews them before importing. */
export function suggestImport(text: string) {
  const widths = ([",", "\t"] as const).map((delimiter) => {
    try {
      const first = parseDelimited(text, delimiter).find(
        (row) => !row[0]?.trimStart().startsWith("#"),
      );
      return { delimiter, width: first?.length ?? 0 };
    } catch {
      return { delimiter, width: 0 };
    }
  });
  const delimiter = widths[1].width > widths[0].width ? "\t" : ",";
  let records: string[][] = [];
  try {
    records = parseDelimited(text, delimiter);
  } catch {
    /* Review displays the parse error. */
  }
  const numeric = (value: string) => {
    try {
      return numericCell(value) !== null;
    } catch {
      return false;
    }
  };
  const preamble = records.findIndex(
    (row) => !row[0]?.trimStart().startsWith("#"),
  );
  const first = Math.max(0, preamble);
  const header =
    !!records[first] &&
    !records[first].some(numeric) &&
    !records[first].some((value) =>
      /^(?:[+-]?(?:inf(?:inity)?|nan)|NA|N\/A|null)$/i.test(value.trim()),
    ) &&
    !!records[first + 1]?.some(numeric);
  // Only suggest skipping a preamble when it ends in a recognizable heading.
  // All records remain visible; arbitrary text in data is never skipped.
  const headerRows = header ? first + 1 : 0;
  const data = records.slice(headerRows, headerRows + 100);
  // Only skip a leading text identifier column. A bad numeric token must not
  // silently redirect Y to an otherwise clean uncertainty column.
  const special = (value: string) =>
    /^(?:[+-]?(?:inf(?:inity)?|nan)|NA|N\/A|null)$/i.test(value.trim());
  const skipId =
    data.length > 0 &&
    data.every(
      (row) => !!row[0]?.trim() && !numeric(row[0]) && !special(row[0]),
    ) &&
    data.some((row) => numeric(row[1] ?? ""));
  return {
    delimiter: delimiter as "," | "\t",
    header,
    headerRows,
    x: skipId ? 1 : 0,
    y: skipId ? 2 : 1,
  };
}
