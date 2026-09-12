import { useEffect, useRef, useState } from "react";
import {
  EXPORT_SIZE_LIMITS,
  exportPngSize,
  validateExportSizing,
  type ExportSizing,
} from "./exportSizing";
import "./exportSizeDialog.css";

export default function ExportSizeDialog({
  value,
  onApply,
  onClose,
}: {
  value: ExportSizing;
  onApply: (value: ExportSizing) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [width, setWidth] = useState(String(value.widthMm));
  const [height, setHeight] = useState(String(value.heightMm));
  const [fontSize, setFontSize] = useState(String(value.fontSizePt));
  const [dpi, setDpi] = useState(value.pngDpi);
  const [preset, setPreset] = useState(
    value.widthMm === 85 && value.heightMm === 60
      ? "single"
      : value.widthMm === 170 && value.heightMm === 100
        ? "double"
        : "custom",
  );
  const [error, setError] = useState("");
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    dialog.current?.showModal();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  const sizing: ExportSizing = {
    widthMm: Number(width),
    heightMm: Number(height),
    fontSizePt: Number(fontSize),
    pngDpi: dpi,
  };
  let pngSummary = "";
  let pngWarning = "";
  if (!validateExportSizing(sizing)) {
    try {
      const pixels = exportPngSize(sizing);
      pngSummary = `${pixels.width} × ${pixels.height} pixels`;
    } catch (reason) {
      pngWarning = reason instanceof Error ? reason.message : String(reason);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="fit-export-size-dialog"
      aria-label="Figure size"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const message = validateExportSizing(sizing);
          if (message) {
            setError(message);
            return;
          }
          onApply(sizing);
          onClose();
        }}
      >
        <h2>Figure size</h2>
        <p>
          Set the printed figure size in millimetres, including all graphs and
          labels. PNG pixel dimensions are shown below. Column presets are
          editable starting points for your journal’s requirements.
        </p>
        <label className="fit-export-size-preset">
          Size preset
          <select
            value={preset}
            onChange={(event) => {
              const next = event.target.value;
              setPreset(next);
              if (next === "single") {
                setWidth("85");
                setHeight("60");
              } else if (next === "double") {
                setWidth("170");
                setHeight("100");
              }
              setError("");
            }}
          >
            <option value="single">Single column · 85 × 60 mm</option>
            <option value="double">Double column · 170 × 100 mm</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <div className="fit-export-size-fields">
          <label>
            Width (mm)
            <input
              type="number"
              min={EXPORT_SIZE_LIMITS.minWidthMm}
              max={EXPORT_SIZE_LIMITS.maxWidthMm}
              step="any"
              value={width}
              onChange={(event) => {
                setWidth(event.target.value);
                setPreset("custom");
                setError("");
              }}
            />
          </label>
          <label>
            Height (mm)
            <input
              type="number"
              min={EXPORT_SIZE_LIMITS.minHeightMm}
              max={EXPORT_SIZE_LIMITS.maxHeightMm}
              step="any"
              value={height}
              onChange={(event) => {
                setHeight(event.target.value);
                setPreset("custom");
                setError("");
              }}
            />
          </label>
          <label>
            Label size (pt)
            <input
              type="number"
              min={EXPORT_SIZE_LIMITS.minFontSizePt}
              max={EXPORT_SIZE_LIMITS.maxFontSizePt}
              step="0.5"
              value={fontSize}
              onChange={(event) => {
                setFontSize(event.target.value);
                setError("");
              }}
            />
          </label>
        </div>
        <label className="fit-export-size-preset">
          PNG resolution
          <select
            value={dpi}
            onChange={(event) => {
              setDpi(Number(event.target.value) as ExportSizing["pngDpi"]);
              setError("");
            }}
          >
            <option value={300}>300 dpi</option>
            <option value={600}>600 dpi</option>
          </select>
        </label>
        <p className="fit-export-size-summary" aria-live="polite">
          {pngSummary && (
            <>
              <strong>PNG: {pngSummary}</strong>
              <br />
            </>
          )}
          SVG and PDF keep vector lines and text at any resolution.
        </p>
        {pngWarning && <p className="fit-export-size-warning">{pngWarning}</p>}
        {error && <p role="alert">{error}</p>}
        <footer>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit">Apply</button>
        </footer>
      </form>
    </dialog>
  );
}
