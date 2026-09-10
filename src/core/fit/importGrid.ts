import { numericCell, type ColumnMapping } from "./dataInput";

/** Paste at an explicit cell, growing the grid without truncating source fields. */
export function pasteGrid(
  grid: string[][],
  row: number,
  column: number,
  block: string[][],
): string[][] {
  const width = Math.max(
    0,
    grid.reduce((width, row) => Math.max(width, row.length), 0),
    column + block.reduce((width, row) => Math.max(width, row.length), 0),
  );
  const height = Math.max(grid.length, row + block.length);
  if (row < 0 || column < 0 || height > 100001 || width > 1000)
    throw new Error("Paste exceeds the 100,000 data-row or 1,000 column limit");
  // A new paste retains ragged records for explicit review (e.g. a missing R row-name heading).
  if (!grid.length && row === 0 && column === 0)
    return block.map((r) => [...r]);
  const ragged = grid.some((r) => r.length !== grid[0]?.length);
  return Array.from({ length: height }, (_, i) => {
    const affected = i >= row && i < row + block.length;
    const rowWidth = ragged
      ? Math.max(
          grid[i]?.length ?? 0,
          affected ? column + block[i - row].length : 0,
        )
      : width;
    const result = Array.from(
      { length: rowWidth },
      (_, j) => grid[i]?.[j] ?? "",
    );
    if (i >= row && i < row + block.length)
      block[i - row].forEach((value, j) => {
        result[column + j] = value;
      });
    return result;
  });
}
export function missingCornerHeading(
  grid: string[][],
  headerRows: number,
): boolean {
  const head = grid[headerRows - 1],
    data = grid.slice(headerRows);
  return (
    headerRows > 0 &&
    !!head &&
    !!data.length &&
    data.every((r) => r.length === head.length + 1)
  );
}
export function alignRowNameHeading(
  grid: string[][],
  headerRows: number,
): string[][] {
  if (!missingCornerHeading(grid, headerRows))
    throw new Error("No missing row-name heading to align");
  return grid.map((row, i) => (i === headerRows - 1 ? ["", ...row] : [...row]));
}
/** The last explicitly designated header row supplies labels; preceding rows remain visible. */
export function importRecords(
  grid: string[][],
  headerRows: number,
): string[][] {
  if (
    !Number.isInteger(headerRows) ||
    headerRows < 0 ||
    headerRows >= grid.length
  )
    throw new Error("Choose header rows so at least one data row remains");
  return grid.slice(headerRows ? headerRows - 1 : 0);
}
export function cellProblem(
  value: string,
  column: number,
  selection: Pick<ColumnMapping, "x" | "y" | "sigma">,
): string | null {
  if (![selection.x, selection.y, selection.sigma].includes(column))
    return null;
  try {
    const number = numericCell(value);
    if (column === selection.sigma && (number === null || number <= 0))
      return "Enter a positive y standard deviation";
    return null;
  } catch {
    return `“${value}” is not a finite number. Correct it or clear the cell to mark it missing.`;
  }
}

export type CellRange = {
  anchor: { row: number; column: number };
  end: { row: number; column: number };
};
export function rangeBounds(range: CellRange) {
  return {
    top: Math.min(range.anchor.row, range.end.row),
    bottom: Math.max(range.anchor.row, range.end.row),
    left: Math.min(range.anchor.column, range.end.column),
    right: Math.max(range.anchor.column, range.end.column),
  };
}
/** Copy values, including blank cells and exact text; row identities never enter the clipboard. */
export function copyGridRange(grid: string[][], range: CellRange): string {
  const { top, bottom, left, right } = rangeBounds(range);
  if (top < 0 || left < 0 || bottom >= 100001 || right >= 1000)
    throw new Error("Selection exceeds table limits");
  const quote = (s: string) =>
    !s || /[\t\n\r"]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  return Array.from({ length: bottom - top + 1 }, (_, i) =>
    Array.from({ length: right - left + 1 }, (_, j) =>
      quote(grid[top + i]?.[left + j] ?? ""),
    ).join("\t"),
  ).join("\n");
}

/** Disjoint selected columns copy side by side in source order, without gaps. */
export function copyGridColumns(
  grid: string[][],
  columns: readonly number[],
): string {
  const ordered = [...new Set(columns)].sort((a, b) => a - b);
  if (!ordered.length || !grid.length) return "";
  if (ordered.some((c) => !Number.isInteger(c) || c < 0 || c >= 1000))
    throw new Error("Invalid column selection");
  const projected = grid.map((row) => ordered.map((c) => row[c] ?? ""));
  return copyGridRange(projected, {
    anchor: { row: 0, column: 0 },
    end: { row: projected.length - 1, column: ordered.length - 1 },
  });
}
