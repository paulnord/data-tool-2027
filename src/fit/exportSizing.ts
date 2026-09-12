export type ExportSizing = {
  widthMm: number;
  heightMm: number;
  fontSizePt: number;
  pngDpi: 300 | 600;
};

export type ExportPlotSize = {
  width: number;
  height: number;
  fontSizePx: number;
  leftMarginPx?: number;
};

export const DEFAULT_EXPORT_SIZING: ExportSizing = {
  widthMm: 85,
  heightMm: 60,
  fontSizePt: 9,
  pngDpi: 300,
};

export const EXPORT_SIZE_LIMITS = {
  minWidthMm: 50,
  maxWidthMm: 300,
  minHeightMm: 40,
  maxHeightMm: 300,
  minFontSizePt: 8,
  maxFontSizePt: 14,
  maxPngPixels: 32_000_000,
  maxPngSide: 16384,
} as const;

/** CSS pixels are physical-layout units here, independent of screen density. */
export function exportSizePixels(
  sizing: Pick<ExportSizing, "widthMm" | "heightMm">,
  dpi = 96,
) {
  return {
    width: (sizing.widthMm * dpi) / 25.4,
    height: (sizing.heightMm * dpi) / 25.4,
  };
}

export function validateExportSizing(sizing: ExportSizing): string | null {
  const limits = EXPORT_SIZE_LIMITS;
  if (
    !Number.isFinite(sizing.widthMm) ||
    sizing.widthMm < limits.minWidthMm ||
    sizing.widthMm > limits.maxWidthMm
  )
    return `Enter a width from ${limits.minWidthMm} to ${limits.maxWidthMm} mm.`;
  if (
    !Number.isFinite(sizing.heightMm) ||
    sizing.heightMm < limits.minHeightMm ||
    sizing.heightMm > limits.maxHeightMm
  )
    return `Enter a height from ${limits.minHeightMm} to ${limits.maxHeightMm} mm.`;
  if (
    !Number.isFinite(sizing.fontSizePt) ||
    sizing.fontSizePt < limits.minFontSizePt ||
    sizing.fontSizePt > limits.maxFontSizePt
  )
    return `Enter a label size from ${limits.minFontSizePt} to ${limits.maxFontSizePt} pt.`;
  if (sizing.pngDpi !== 300 && sizing.pngDpi !== 600)
    return "Choose 300 or 600 dpi for PNG resolution.";
  return null;
}

/** Do not silently reduce a publication figure's requested raster resolution. */
export function exportPngSize(sizing: ExportSizing) {
  const error = validateExportSizing(sizing);
  if (error) throw new Error(error);
  const size = exportSizePixels(sizing, sizing.pngDpi);
  const width = Math.round(size.width);
  const height = Math.round(size.height);
  if (
    width * height > EXPORT_SIZE_LIMITS.maxPngPixels ||
    Math.max(width, height) > EXPORT_SIZE_LIMITS.maxPngSide
  )
    throw new Error(
      "This PNG exceeds the image size limit. Choose 300 dpi or smaller figure dimensions, or export SVG or PDF.",
    );
  return { width, height };
}

/** Allocate the requested figure height without shrinking labels or markers. */
export function layoutExportPlots(
  sizing: ExportSizing,
  residualFlags: boolean[],
): ExportPlotSize[] {
  const error = validateExportSizing(sizing);
  if (error) throw new Error(error);
  if (!residualFlags.length)
    throw new Error("No graph is available to export.");
  const { width, height } = exportSizePixels(sizing);
  const fontSizePx = (sizing.fontSizePt * 96) / 72;
  const minimums = residualFlags.map(
    (residual) => fontSizePx * (residual ? 6.2 : 7.5),
  );
  const minimumHeight = minimums.reduce((sum, value) => sum + value, 0);
  if (height < minimumHeight) {
    const needed = Math.ceil((minimumHeight * 25.4) / 96);
    throw new Error(
      `These ${residualFlags.length} plots need a figure height of at least ${needed} mm at ${sizing.fontSizePt} pt. Increase the height or hide residuals.`,
    );
  }
  const weights = residualFlags.map((residual) => (residual ? 1 : 3));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  return minimums.map((minimum, index) => ({
    width,
    height: minimum + ((height - minimumHeight) * weights[index]) / totalWeight,
    fontSizePx,
  }));
}

/** Keep every frame aligned while reserving room for the widest Y tick. */
export function fitExportPlotMargins(
  sizes: ExportPlotSize[],
  yTickWidths: number[],
): ExportPlotSize[] {
  if (!sizes.length) return sizes;
  const fontSize = Math.max(...sizes.map((size) => size.fontSizePx));
  const widestTick = Math.max(0, ...yTickWidths.filter(Number.isFinite));
  // The embedded PDF font has wider numerals than common browser sans fonts.
  // Keep that reserve separate from the title area and the tick/frame gap.
  const labelArea = Math.max(25, fontSize * 1.6);
  const leftMarginPx = Math.max(
    58,
    fontSize * 5.2,
    Math.ceil(labelArea + 10 + widestTick * 1.2),
  );
  const right = Math.max(12, fontSize);
  const minimumFrameWidth = Math.max(80, fontSize * 6);
  if (
    sizes.some((size) => size.width - leftMarginPx - right < minimumFrameWidth)
  ) {
    const minimumWidth = Math.ceil(
      ((leftMarginPx + right + minimumFrameWidth) * 25.4) / 96,
    );
    throw new Error(
      `These axis labels need a figure width of at least ${minimumWidth} mm. Increase Width or reduce Label size.`,
    );
  }
  return sizes.map((size) => ({ ...size, leftMarginPx }));
}
