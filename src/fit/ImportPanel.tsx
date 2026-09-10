import { isTauri, invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import {
  analysisFromTable,
  columnHeading,
  tableCsv,
  insertTableColumn,
  tableForAnalysis,
  type TableAnalysis,
} from "../core/fit/dataTable";
import { useEffect, useRef, useState } from "react";
import { parseDelimited, suggestImport } from "../core/fit/dataInput";
import {
  alignRowNameHeading,
  cellProblem,
  missingCornerHeading,
  pasteGrid,
  rangeBounds,
  copyGridRange,
  copyGridColumns,
  type CellRange,
} from "../core/fit/importGrid";
import { type DataTable } from "../core/fit/schema";

export function ImportPanel({
  source,
  text,
  onClose,
  onApply,
  analysis,
  onOpen,
  externalError,
  reviewing = false,
  fileName,
}: {
  reviewing?: boolean;
  fileName?: string;
  source: string;
  text?: string;
  onClose: () => void;
  analysis?: TableAnalysis;
  onOpen?: () => void;
  externalError?: string;
  onApply: (value: TableAnalysis, replacement?: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [cells, setCellRange] = useState<CellRange | null>(null);
  const [columns, setColumns] = useState<number[]>([]);
  const columnDrag = useRef<{ anchor: number; base: number[] } | null>(null);
  const columnAnchor = useRef(0);
  function setCells(value: CellRange | null) {
    setColumns([]);
    setCellRange(value);
  }
  const [columnMenu, setColumnMenu] = useState<number | null>(null);
  const dragging = useRef<CellRange["anchor"] | null>(null);
  useEffect(() => {
    const end = () => {
      dragging.current = null;
      columnDrag.current = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);
  const bounds = cells ? rangeBounds(cells) : null;
  const multiple =
    !!bounds && (bounds.bottom > bounds.top || bounds.right > bounds.left);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const initial = useRef(
    analysis ? tableForAnalysis(analysis) : undefined,
  ).current;
  const [base, setBase] = useState(analysis);
  const [tableName, setTableName] = useState(source);
  const [sourceFileName, setSourceFileName] = useState<string | null>(
    fileName ?? analysis?.request.source.fileName ?? null,
  );
  const [loadPending, setLoadPending] = useState(false);
  const suggestion = useRef(suggestImport(text ?? "")).current;
  const [raw, setRaw] = useState(text ?? "");
  const [delimiter, setDelimiter] = useState(suggestion.delimiter);
  const [grid, setGrid] = useState<string[][]>(() => {
    try {
      return (
        initial?.cells ??
        (text ? parseDelimited(text, suggestion.delimiter) : [])
      );
    } catch {
      return [];
    }
  });
  const [rowIds, setRowIds] = useState(
    () => initial?.rowIds ?? grid.map(() => crypto.randomUUID()),
  );
  const [headerRows, setHeaderRows] = useState(
    initial?.headerRows ?? suggestion.headerRows,
  );
  const [selection, setSelection] = useState({
    x: initial?.x ?? suggestion.x,
    y: initial?.y ?? suggestion.y,
    sigma: initial?.sigma ?? (null as number | null),
  });
  const [columnUnits, setColumnUnits] = useState(initial?.units ?? []);
  const [message, setMessage] = useState(() => {
    try {
      if (text) parseDelimited(text, suggestion.delimiter);
      return "";
    } catch (e) {
      return (e as Error).message;
    }
  });
  const [page, setPage] = useState(0);
  type Snapshot = {
    grid: string[][];
    headerRows: number;
    selection: typeof selection;
    rowIds: string[];
    base: typeof base;
    columnUnits: string[];
    tableName: string;
    sourceFileName: string | null;
    page: number;
    cells: CellRange | null;
    columns: number[];
    raw: string;
    delimiter: typeof delimiter;
  };
  type Checkpoint = { value: Snapshot; label: string };
  const [past, setPast] = useState<Checkpoint[]>([]);
  const [future, setFuture] = useState<Checkpoint[]>([]);
  const editGroup = useRef<string | null>(null);
  function snapshot(): Snapshot {
    return {
      grid,
      headerRows,
      selection,
      rowIds,
      base,
      columnUnits,
      tableName,
      sourceFileName,
      page,
      cells,
      columns,
      raw,
      delimiter,
    };
  }
  function restore(value: Snapshot) {
    setGrid(value.grid);
    setHeaderRows(value.headerRows);
    setSelection(value.selection);
    setRowIds(value.rowIds);
    setBase(value.base);
    setColumnUnits(value.columnUnits);
    setTableName(value.tableName);
    setSourceFileName(value.sourceFileName);
    setPage(value.page);
    setCellRange(value.cells);
    setColumns(value.columns);
    setRaw(value.raw);
    setDelimiter(value.delimiter);
    setMessage("");
  }
  function history(redo = false) {
    setColumnMenu(null);
    editGroup.current = null;
    const entries = redo ? future : past,
      entry = entries.at(-1);
    if (!entry) return;
    const current = { value: snapshot(), label: entry.label };
    if (redo) {
      setFuture(entries.slice(0, -1));
      setPast((values) => [...values.slice(-99), current]);
    } else {
      setPast(entries.slice(0, -1));
      setFuture((values) => [...values, current]);
    }
    restore(entry.value);
  }
  const width =
    grid.reduce((width, row) => Math.max(width, row.length), 0) || 2;
  const labels = Array.from({ length: width }, (_, i) =>
    headerRows && grid[headerRows - 1]?.[i]?.trim()
      ? grid[headerRows - 1][i]
      : `Column ${i + 1}`,
  );
  let candidate: TableAnalysis | undefined,
    error = "";
  const table: DataTable = {
    cells: grid,
    rowIds,
    headerRows,
    ...selection,
    units: labels.map((label, i) => columnHeading(label, columnUnits[i]).unit),
  };
  if (grid.length)
    try {
      candidate = analysisFromTable(table, tableName, base, sourceFileName);
    } catch (e) {
      error = (e as Error).message;
    }
  const request = candidate?.request;
  const missing =
    request?.dataset.rows.filter((row) => !row.included).length ?? 0;
  function problemFor(row: string[], column: number) {
    if (
      column === selection.sigma &&
      !row[column]?.trim() &&
      (!row[selection.x]?.trim() || !row[selection.y]?.trim())
    )
      return null;
    return cellProblem(row[column] ?? "", column, selection);
  }
  const issues = grid.flatMap((row, i) =>
    i < headerRows
      ? []
      : row.flatMap((_, j) =>
          problemFor(row, j)
            ? [
                {
                  row: i,
                  column: j,
                  message: problemFor(row, j)!,
                },
              ]
            : [],
        ),
  );
  function remember(label: string, group?: string) {
    setFuture([]);
    if (!group || editGroup.current !== group)
      setPast((values) => [...values.slice(-99), { value: snapshot(), label }]);
    editGroup.current = group ?? null;
  }
  function receive(value: string, row = 0, column = 0, replace = false) {
    try {
      const guessed = suggestImport(value),
        block = parseDelimited(value, guessed.delimiter);
      const next = pasteGrid(replace ? [] : grid, row, column, block);
      remember("Paste cells");
      setGrid(next);
      setRowIds(
        next.map((_, i) =>
          replace ? crypto.randomUUID() : (rowIds[i] ?? crypto.randomUUID()),
        ),
      );
      setMessage("");
      setCells({
        anchor: { row, column },
        end: {
          row: row + block.length - 1,
          column: column + Math.max(...block.map((r) => r.length)) - 1,
        },
      });
      if (!grid.length || replace) {
        setColumnUnits([]);
        setSourceFileName(null);
        setSelection({ x: guessed.x, y: guessed.y, sigma: null });
        setHeaderRows(guessed.headerRows);
        setDelimiter(guessed.delimiter);
        setPage(0);
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function edit(row: number, column: number, value: string) {
    // One-cell typing is an explicit correction; assignments and header interpretation stay fixed.
    if ((grid[row]?.[column] ?? "") === value) return;
    remember(`Edit R${row + 1} C${column + 1}`, `cell:${row}:${column}`);
    const next = pasteGrid(grid, row, column, [[value]]);
    setGrid(next);
    setRowIds(next.map((_, i) => rowIds[i] ?? crypto.randomUUID()));
    setMessage("");
  }
  const protectedColumns = columns.some(
    (i) => i === selection.x || i === selection.y || i === selection.sigma,
  );
  function deleteColumns() {
    if (!columns.length || protectedColumns) return;
    const removed = new Set(columns);
    const shifted = (i: number) => i - columns.filter((c) => c < i).length;
    const trim = (rows: string[][]) =>
      rows.map((row) => row.filter((_, i) => !removed.has(i)));
    remember(`Delete columns ${columns.map((i) => i + 1).join(", ")}`);
    setGrid(trim(grid));
    setColumnUnits(columnUnits.filter((_, i) => !removed.has(i)));
    setSelection({
      x: shifted(selection.x),
      y: shifted(selection.y),
      sigma: selection.sigma === null ? null : shifted(selection.sigma),
    });
    if (candidate) {
      const prior = tableForAnalysis(candidate);
      setBase({
        ...candidate,
        dataTable: {
          ...prior,
          cells: trim(prior.cells),
          units: prior.units.filter((_, i) => !removed.has(i)),
          x: shifted(prior.x),
          y: shifted(prior.y),
          sigma: prior.sigma === null ? null : shifted(prior.sigma),
        },
      });
    }
    setCells(null);
    setColumnMenu(null);
    setMessage("");
  }
  function insertColumn(index: number) {
    if (width >= 1000) return;
    const source = grid.length
      ? table
      : { ...table, cells: [["", ""]], rowIds: [crypto.randomUUID()] };
    const next = insertTableColumn(source, index);
    remember("Insert column");
    setGrid(next.cells);
    setRowIds(next.rowIds);
    setColumnUnits(next.units);
    setSelection({ x: next.x, y: next.y, sigma: next.sigma });
    if (candidate)
      setBase({
        ...candidate,
        dataTable: insertTableColumn(tableForAnalysis(candidate), index),
      });
    setCellRange(null);
    setColumns([index]);
    columnAnchor.current = index;
    setColumnMenu(null);
    setMessage("");
  }
  function selectColumn(i: number, additive = false, extend = false) {
    editGroup.current = null;
    setCellRange(null);
    if (extend) {
      const start = Math.min(columnAnchor.current, i),
        end = Math.max(columnAnchor.current, i);
      setColumns(Array.from({ length: end - start + 1 }, (_, j) => start + j));
    } else {
      columnAnchor.current = i;
      setColumns(
        additive
          ? columns.includes(i)
            ? columns.filter((c) => c !== i)
            : [...columns, i].sort((a, b) => a - b)
          : [i],
      );
    }
  }
  function selectionText() {
    return columns.length
      ? copyGridColumns(grid, columns)
      : cells
        ? copyGridRange(grid, cells)
        : "";
  }
  async function copySelection() {
    try {
      await navigator.clipboard.writeText(selectionText());
      setColumnMenu(null);
    } catch {
      setMessage("Use ⌘C to copy the selected cells.");
    }
  }
  function clearCells() {
    const selected = (r: number, c: number) =>
      columns.length
        ? columns.includes(c)
        : !!bounds &&
          r >= bounds.top &&
          r <= bounds.bottom &&
          c >= bounds.left &&
          c <= bounds.right;
    if (
      !grid.some((row, r) =>
        row.some((value, c) => selected(r, c) && value !== ""),
      )
    )
      return;
    remember("Clear cells");
    setGrid(
      grid.map((row, r) =>
        row.map((value, c) => (selected(r, c) ? "" : value)),
      ),
    );
    setColumnMenu(null);
    setMessage("");
  }
  async function exportCsv() {
    try {
      const data = tableCsv(table);
      const name =
        (tableName
          .replace(/\.[^.]+$/, "")
          .replace(/[\\/:*?"<>|]/g, "_")
          .trim() || "data") + ".csv";
      if (isTauri()) {
        const path = await save({
          defaultPath: name,
          filters: [{ name: "CSV table", extensions: ["csv"] }],
        });
        if (!path) return;
        await invoke("write_fit_csv", { path, data });
      } else {
        const url = URL.createObjectURL(
          new Blob([data], { type: "text/csv;charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage(
        "CSV exported. Use Save session to retain fit settings and analysis notes.",
      );
    } catch (error) {
      setMessage(`CSV export failed: ${String(error)}`);
    }
  }
  const unchanged =
    tableName === source &&
    !!initial &&
    base === analysis &&
    JSON.stringify({ ...initial, units: initial.units.slice(0, width) }) ===
      JSON.stringify(table);
  const shown = grid.length
    ? [...grid, Array.from({ length: width }, () => "")]
    : Array.from({ length: 5 }, () => ["", ""]);
  return (
    <dialog
      ref={dialog}
      className="fit-data-dialog fit-import-dialog"
      aria-label="Data"
      onPointerDownCapture={(e) => {
        if (!(e.target as HTMLElement).closest(".fit-column-heading"))
          setColumnMenu(null);
      }}
      onBlurCapture={() => {
        editGroup.current = null;
      }}
      onKeyDownCapture={(e) => {
        if (e.key === "Escape" && columnMenu !== null) {
          e.preventDefault();
          e.stopPropagation();
          setColumnMenu(null);
          return;
        }
        if (
          (e.key === "Delete" || e.key === "Backspace") &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey &&
          (bounds || columns.length > 0) &&
          ((e.target as HTMLElement).closest(".fit-column-select") ||
            (multiple && (e.target as HTMLElement).closest(".fit-paste-grid")))
        ) {
          e.preventDefault();
          e.stopPropagation();
          clearCells();
          return;
        }
        if (
          (e.metaKey || e.ctrlKey) &&
          !e.altKey &&
          (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")
        ) {
          e.preventDefault();
          e.stopPropagation();
          history(e.shiftKey || e.key.toLowerCase() === "y");
        } else if (e.key === "Enter") editGroup.current = null;
      }}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <h2>Data</h2>
      {externalError && (
        <p role="alert" className="fit-error">
          {externalError}
        </p>
      )}
      <div className="fit-grid-toolbar">
        <button
          className="fit-history-icon"
          aria-label="Undo table change"
          disabled={!past.length}
          title={`Undo${past.length ? `: ${past.at(-1)?.label}` : ""} (⌘Z)`}
          onClick={() => history()}
        >
          <span aria-hidden="true">↶</span>
        </button>
        <button
          className="fit-history-icon"
          aria-label="Redo table change"
          disabled={!future.length}
          title={`Redo${future.length ? `: ${future.at(-1)?.label}` : ""} (⇧⌘Z)`}
          onClick={() => history(true)}
        >
          <span aria-hidden="true">↷</span>
        </button>

        {onOpen && (
          <button
            onClick={() => {
              if (past.length) setLoadPending(true);
              else onOpen();
            }}
          >
            Load file…
          </button>
        )}
        <button
          onClick={() => {
            remember("New table");
            setCells(null);
            setGrid([]);
            setRowIds([]);
            setHeaderRows(0);
            setSelection({ x: 0, y: 1, sigma: null });
            setColumnUnits([]);
            setBase(undefined);
            setTableName("Pasted data");
            setSourceFileName(null);
            setPage(0);
            setMessage("");
          }}
        >
          New table
        </button>
        <button disabled={!grid.length} onClick={exportCsv}>
          Export CSV…
        </button>
        <button disabled={width >= 1000} onClick={() => insertColumn(width)}>
          Add column
        </button>
        <div className="fit-data-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="fit-use-data"
            disabled={
              !(reviewing && unchanged) &&
              (!request || !!error || !grid.length || !!issues.length)
            }
            onClick={() => {
              if (unchanged) {
                if (reviewing && analysis) onApply(analysis, false);
                else onClose();
                return;
              }
              if (candidate) {
                if (!base) {
                  const id = crypto.randomUUID();
                  candidate = {
                    ...candidate,
                    request: {
                      ...candidate.request,
                      requestId: id,
                      snapshotId: id,
                      dataset: { ...candidate.request.dataset, id },
                    },
                  };
                }
                onApply(candidate, !base);
              }
            }}
          >
            Use these data
          </button>
        </div>
      </div>
      {loadPending && (
        <p role="alert">
          Replace the table draft with new data?{" "}
          <button
            onClick={() => {
              setLoadPending(false);
              onOpen?.();
            }}
          >
            Discard draft and load
          </button>{" "}
          <button onClick={() => setLoadPending(false)}>Keep table</button>
        </p>
      )}
      <p>
        Drag across cells or Shift-click to select a block. Copy (⌘C / Ctrl+C),
        click the destination, then paste (⌘V / Ctrl+V). Click or drag across
        column headings; Option-click adds or removes individual columns.
        Right-click for Copy, Clear or Delete. Double-click a cell to edit its
        text.
      </p>
      <div className="fit-import-choices">
        {(["x", "y", "sigma"] as const).map((key) => (
          <label key={key}>
            {key === "sigma" ? "Y uncertainty (optional)" : key.toUpperCase()}
            <select
              aria-label={`${key} column`}
              value={selection[key] ?? -1}
              onChange={(e) => {
                remember(
                  `Assign ${key === "sigma" ? "uncertainty" : key.toUpperCase()} column`,
                );
                setSelection({
                  ...selection,
                  ...(key === "y" ? { sigma: null } : {}),
                  [key]:
                    Number(e.target.value) < 0 ? null : Number(e.target.value),
                });
              }}
            >
              {key === "sigma" && <option value={-1}>None</option>}
              {labels.map((label, i) => (
                <option key={i} value={i}>
                  {columnHeading(label).label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="fit-grid-toolbar">
        <label>
          Header rows{" "}
          <input
            aria-label="Header rows"
            type="number"
            min={0}
            max={Math.max(0, grid.length - 1)}
            value={headerRows}
            onChange={(e) => {
              remember("Change header rows", "headers");
              setHeaderRows(Number(e.target.value));
            }}
          />
        </label>
        <span>
          {headerRows
            ? `Rows 1–${headerRows} are headings, not data. Last heading supplies column names; “Time (s)” declares a unit.`
            : "Every row is data."}
        </span>
        <span className="fit-history-hint">
          {past.length ? `Undo: ${past.at(-1)!.label}` : "No changes to undo"}
        </span>
      </div>
      {missingCornerHeading(grid, headerRows) && (
        <p role="alert" className="fit-warning">
          The heading has one fewer cell than the data. Is the first column row
          names?{" "}
          <button
            onClick={() => {
              remember("Align heading");
              setGrid(alignRowNameHeading(grid, headerRows));
            }}
          >
            Add blank row-name heading
          </button>
        </p>
      )}
      <div className="fit-grid-toolbar">
        <span>
          {columns.length
            ? `Selected columns ${columns.map((i) => i + 1).join(", ")}`
            : bounds
              ? `Selected rows ${bounds.top + 1}–${bounds.bottom + 1}, columns ${bounds.left + 1}–${bounds.right + 1}`
              : "Select cells to copy"}
        </span>
      </div>
      <div
        className="fit-data-scroll fit-paste-grid"
        onCopy={(e) => {
          if (
            (cells || columns.length) &&
            !(e.target instanceof HTMLInputElement)
          ) {
            e.preventDefault();
            e.clipboardData.setData("text/plain", selectionText());
          }
        }}
        onPaste={(e) => {
          if (columns.length && !(e.target instanceof HTMLInputElement)) {
            e.preventDefault();
            if (columns.length > 1)
              setMessage("Click a destination cell before pasting a block.");
            else receive(e.clipboardData.getData("text"), 0, columns[0]);
            return;
          }
          if (bounds && !(e.target instanceof HTMLInputElement)) {
            e.preventDefault();
            receive(e.clipboardData.getData("text"), bounds.top, bounds.left);
          }
        }}
      >
        <table aria-label="Paste data table">
          <thead>
            <tr>
              <th>
                <button
                  aria-label="Select entire table"
                  title="Select entire table"
                  disabled={!grid.length}
                  onClick={() => {
                    editGroup.current = null;
                    setCells({
                      anchor: { row: 0, column: 0 },
                      end: {
                        row: grid.length - 1,
                        column: grid.reduce(
                          (last, row) => Math.max(last, row.length - 1),
                          0,
                        ),
                      },
                    });
                  }}
                >
                  All
                </button>
              </th>
              {labels.map((label, i) => (
                <th
                  key={i}
                  className="fit-column-heading fit-column-select"
                  tabIndex={0}
                  aria-label={`Select column ${i + 1}`}
                  aria-selected={columns.includes(i)}
                  onPointerDown={(e) => {
                    if (
                      e.button !== 0 ||
                      (e.target as HTMLElement).closest(".fit-column-menu")
                    )
                      return;
                    e.preventDefault();
                    e.currentTarget.focus();
                    setColumnMenu(null);
                    const additive = e.altKey || e.metaKey || e.ctrlKey;
                    const anchor = e.shiftKey ? columnAnchor.current : i;
                    columnDrag.current = {
                      anchor,
                      base: additive ? columns : [],
                    };
                    selectColumn(i, additive, e.shiftKey);
                  }}
                  onPointerEnter={(e) => {
                    const drag = columnDrag.current;
                    if (drag && e.buttons & 1) {
                      const start = Math.min(drag.anchor, i),
                        end = Math.max(drag.anchor, i);
                      setColumns(
                        [
                          ...new Set([
                            ...drag.base,
                            ...Array.from(
                              { length: end - start + 1 },
                              (_, j) => start + j,
                            ),
                          ]),
                        ].sort((a, b) => a - b),
                      );
                      setCellRange(null);
                    }
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!columns.includes(i)) selectColumn(i);
                    setColumnMenu(i);
                    e.currentTarget.focus();
                  }}
                  onKeyDown={(e) => {
                    if ((e.target as HTMLElement).closest(".fit-column-menu"))
                      return;
                    if (
                      (e.shiftKey && e.key === "F10") ||
                      e.key === "ContextMenu"
                    ) {
                      e.preventDefault();
                      if (!columns.includes(i)) selectColumn(i);
                      setColumnMenu(i);
                    } else if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      selectColumn(
                        i,
                        e.altKey || e.metaKey || e.ctrlKey,
                        e.shiftKey,
                      );
                    }
                  }}
                >
                  {columnHeading(label).label}
                  <span className="fit-column-role">
                    {i === selection.x
                      ? "X · number"
                      : i === selection.y
                        ? "Y · number"
                        : i === selection.sigma
                          ? "σy · positive number"
                          : "Not used"}
                  </span>
                  {columnMenu === i && (
                    <div
                      role="menu"
                      aria-label={`Column ${i + 1} actions`}
                      className="fit-column-menu"
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setColumnMenu(null);
                        }
                      }}
                    >
                      <button role="menuitem" onClick={copySelection}>
                        Copy
                      </button>
                      <button
                        role="menuitem"
                        disabled={width >= 1000}
                        onClick={() => insertColumn(i)}
                      >
                        Insert column left
                      </button>
                      <button
                        role="menuitem"
                        disabled={width >= 1000}
                        onClick={() => insertColumn(i + 1)}
                      >
                        Insert column right
                      </button>
                      <button role="menuitem" onClick={clearCells}>
                        Clear contents
                      </button>
                      <button
                        role="menuitem"
                        aria-label={
                          columns.length > 1
                            ? "Delete selected columns"
                            : `Delete column ${i + 1}`
                        }
                        disabled={
                          protectedColumns ||
                          !columns.some((c) =>
                            grid.some((row) => c < row.length),
                          )
                        }
                        title="Reassign X, Y or uncertainty before deleting an assigned column"
                        onClick={deleteColumns}
                      >
                        {columns.length > 1
                          ? "Delete selected columns"
                          : "Delete column"}
                      </button>
                      <button
                        role="menuitem"
                        onClick={() => setColumnMenu(null)}
                      >
                        Close menu
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
            <tr className="fit-unit-row">
              <th scope="row">Units</th>
              {labels.map((label, i) => (
                <td key={i}>
                  <input
                    aria-label={
                      i === selection.x
                        ? "x unit"
                        : i === selection.y
                          ? "y unit"
                          : `Column ${i + 1} unit`
                    }
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    title="Unit metadata only; numbers are not converted"
                    placeholder="—"
                    value={columnHeading(label, columnUnits[i]).unit}
                    onChange={(e) => {
                      remember(`Change column ${i + 1} unit`, `unit-${i}`);
                      const next = labels.map(
                        (text, j) => columnHeading(text, columnUnits[j]).unit,
                      );
                      next[i] = e.target.value;
                      setColumnUnits(next);
                    }}
                  />
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.slice(page * 100, page * 100 + 100).map((row, offset) => {
              const i = page * 100 + offset;
              return (
                <tr key={i} className={i < headerRows ? "fit-header-row" : ""}>
                  <th>
                    <button
                      className="fit-row-select"
                      aria-label={`Select row ${i + 1}`}
                      onClick={(e) => {
                        const start =
                          e.shiftKey && cells ? cells.anchor.row : i;
                        setCells({
                          anchor: { row: start, column: 0 },
                          end: { row: i, column: width - 1 },
                        });
                      }}
                    >
                      {i + 1}
                      {i < headerRows ? " · heading" : ""}
                    </button>
                    <button
                      disabled={i >= grid.length}
                      aria-label={`Delete ${rowIds[i] ?? `row-${i + 1}`}`}
                      onClick={() => {
                        remember("Delete row");
                        setCells(null);
                        setGrid(grid.filter((_, j) => j !== i));
                        setRowIds(rowIds.filter((_, j) => j !== i));
                        if (i < headerRows) setHeaderRows(headerRows - 1);
                      }}
                    >
                      ×
                    </button>
                  </th>
                  {labels.map((_, j) => {
                    const problem = i < headerRows ? null : problemFor(row, j);
                    return (
                      <td
                        key={j}
                        className={
                          columns.includes(j) ||
                          (bounds &&
                            i >= bounds.top &&
                            i <= bounds.bottom &&
                            j >= bounds.left &&
                            j <= bounds.right)
                            ? "fit-cell-selected"
                            : ""
                        }
                      >
                        <input
                          autoFocus={!text && i === 0 && j === 0}
                          aria-label={`Row ${i + 1} column ${j + 1}`}
                          aria-invalid={!!problem && !!grid.length}
                          title={problem ?? ""}
                          value={row[j] ?? ""}
                          onFocus={() => {
                            if (!dragging.current)
                              setCells({
                                anchor: { row: i, column: j },
                                end: { row: i, column: j },
                              });
                          }}
                          onPointerDown={(e) => {
                            if (e.button !== 0) return;
                            editGroup.current = null;
                            const anchor =
                              e.shiftKey && cells
                                ? cells.anchor
                                : { row: i, column: j };
                            dragging.current = anchor;
                            setCells({ anchor, end: { row: i, column: j } });
                            if (e.detail < 2) {
                              e.preventDefault();
                              e.currentTarget.focus();
                              e.currentTarget.select();
                            }
                          }}
                          onPointerEnter={(e) => {
                            if (dragging.current && e.buttons & 1) {
                              setCells({
                                anchor: dragging.current,
                                end: { row: i, column: j },
                              });
                            }
                          }}
                          onCopy={(e) => {
                            if (
                              cells &&
                              (multiple ||
                                e.currentTarget.selectionStart ===
                                  e.currentTarget.selectionEnd ||
                                (e.currentTarget.selectionStart === 0 &&
                                  e.currentTarget.selectionEnd ===
                                    e.currentTarget.value.length))
                            ) {
                              e.preventDefault();
                              e.clipboardData.setData(
                                "text/plain",
                                copyGridRange(grid, cells),
                              );
                            }
                          }}
                          onCut={(e) => {
                            if (multiple) {
                              e.preventDefault();
                              setMessage(
                                "For a cell block, use Copy and Paste. Cutting text is available within a single cell.",
                              );
                            }
                          }}
                          onChange={(e) => edit(i, j, e.target.value)}
                          onPaste={(e) => {
                            e.preventDefault();
                            receive(
                              e.clipboardData.getData("text"),
                              multiple && bounds ? bounds.top : i,
                              multiple && bounds ? bounds.left : j,
                            );
                          }}
                          onKeyDown={(e) => {
                            if (
                              e.shiftKey &&
                              [
                                "ArrowUp",
                                "ArrowDown",
                                "ArrowLeft",
                                "ArrowRight",
                              ].includes(e.key)
                            ) {
                              e.preventDefault();
                              const start = cells ?? {
                                anchor: { row: i, column: j },
                                end: { row: i, column: j },
                              };
                              const end = {
                                row: Math.max(
                                  0,
                                  Math.min(
                                    shown.length - 1,
                                    start.end.row +
                                      (e.key === "ArrowDown"
                                        ? 1
                                        : e.key === "ArrowUp"
                                          ? -1
                                          : 0),
                                  ),
                                ),
                                column: Math.max(
                                  0,
                                  Math.min(
                                    width - 1,
                                    start.end.column +
                                      (e.key === "ArrowRight"
                                        ? 1
                                        : e.key === "ArrowLeft"
                                          ? -1
                                          : 0),
                                  ),
                                ),
                              };
                              setCells({ ...start, end });
                              setPage(Math.floor(end.row / 100));
                              return;
                            }

                            if (
                              ["ArrowUp", "ArrowDown", "Enter"].includes(e.key)
                            ) {
                              e.preventDefault();
                              const next = i + (e.key === "ArrowUp" ? -1 : 1);
                              dialog.current
                                ?.querySelector<HTMLInputElement>(
                                  `[aria-label="Row ${next + 1} column ${j + 1}"]`,
                                )
                                ?.focus();
                            }
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="fit-grid-toolbar">
        <button
          onClick={() => {
            remember("Add row");
            setGrid([
              ...grid,
              Array.from(
                {
                  length: grid.reduce((n, r) => Math.max(n, r.length), 0) || 2,
                },
                () => "",
              ),
            ]);
            setRowIds([...rowIds, crypto.randomUUID()]);
            setPage(Math.floor(grid.length / 100));
          }}
        >
          Add row
        </button>
        <span>
          {grid.length
            ? `${Math.max(0, grid.length - headerRows)} data rows`
            : "Paste into the first cell to begin"}
          {missing
            ? ` · ${missing} with missing x/y will be kept but excluded from fitting`
            : ""}
        </span>
        {shown.length > 100 && (
          <>
            <button disabled={!page} onClick={() => setPage(page - 1)}>
              Previous rows
            </button>
            <span>Page {page + 1}</span>
            <button
              disabled={(page + 1) * 100 >= shown.length}
              onClick={() => setPage(page + 1)}
            >
              Next rows
            </button>
          </>
        )}
      </div>
      {!!issues.length && (
        <p role="alert" className="fit-error">
          {issues.length} invalid numeric{" "}
          {issues.length === 1 ? "cell" : "cells"}. Row {issues[0].row + 1},
          column {issues[0].column + 1}: {issues[0].message}{" "}
          <button
            onClick={() => {
              setPage(Math.floor(issues[0].row / 100));
              setTimeout(
                () =>
                  dialog.current
                    ?.querySelector<HTMLInputElement>(
                      `[aria-label="Row ${issues[0].row + 1} column ${issues[0].column + 1}"]`,
                    )
                    ?.focus(),
                0,
              );
            }}
          >
            Go to cell
          </button>
        </p>
      )}
      {!!error && !issues.length && (
        <p role="alert" className="fit-error">
          {error}
        </p>
      )}
      {message && (
        <p
          role="alert"
          className={
            message.startsWith("Y changed") ||
            message.startsWith("CSV exported")
              ? "fit-help"
              : "fit-error"
          }
        >
          {message}
        </p>
      )}
      <details className="fit-import-options">
        <summary>Import options</summary>
        <p>
          {source}. Units are optional labels and never convert values. Blank
          numeric cells mean missing; text such as inf, NaN or NA must be
          corrected or cleared explicitly.
        </p>
        <div className="fit-data-fields">
          <label>
            Dataset title
            <input
              aria-label="Dataset title"
              value={tableName}
              onChange={(e) => {
                remember("Change dataset title", "title");
                setTableName(e.target.value);
              }}
            />
          </label>
        </div>
        <details>
          <summary>Replace from source text</summary>
          <textarea
            aria-label="Delimited text"
            value={raw}
            onChange={(e) => {
              remember("Edit source text", "source-text");
              setRaw(e.target.value);
            }}
          />
          <label>
            Delimiter
            <select
              aria-label="Delimiter"
              value={delimiter}
              onChange={(e) => {
                remember("Change delimiter");
                setDelimiter(e.target.value as "," | "\t");
              }}
            >
              <option value=",">Comma (CSV)</option>
              <option value={"\t"}>Tab (TSV)</option>
            </select>
          </label>
          <button
            onClick={() => {
              try {
                const records = parseDelimited(raw, delimiter);
                remember("Replace from text");
                setGrid(records);
                setRowIds(records.map(() => crypto.randomUUID()));
                setHeaderRows(0);
                setPage(0);
                setMessage("Source replaced. Set header rows above if needed.");
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Replace table
          </button>
        </details>
      </details>
    </dialog>
  );
}
