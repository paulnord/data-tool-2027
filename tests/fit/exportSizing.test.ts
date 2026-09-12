import { describe, expect, it } from "vitest";
import {
  DEFAULT_EXPORT_SIZING,
  exportPngSize,
  exportSizePixels,
  fitExportPlotMargins,
  layoutExportPlots,
  validateExportSizing,
} from "../../src/fit/exportSizing";

describe("physical figure sizing", () => {
  it("converts physical dimensions independently of screen or raster density", () => {
    const sizing = { ...DEFAULT_EXPORT_SIZING, widthMm: 127, heightMm: 76.2 };
    expect(exportSizePixels(sizing).width).toBeCloseTo(480, 12);
    expect(exportSizePixels(sizing).height).toBeCloseTo(288, 12);
    expect(exportPngSize(sizing)).toEqual({ width: 1500, height: 900 });
    expect(exportPngSize({ ...sizing, pngDpi: 600 })).toEqual({
      width: 3000,
      height: 1800,
    });
  });

  it("preserves requested total dimensions and label size across plot counts", () => {
    const sizing = { ...DEFAULT_EXPORT_SIZING, heightMm: 240, fontSizePt: 10 };
    const layout = layoutExportPlots(sizing, [false, true, false, true]);
    const figure = exportSizePixels(sizing);
    expect(layout.reduce((sum, plot) => sum + plot.height, 0)).toBeCloseTo(
      figure.height,
      12,
    );
    for (const plot of layout) {
      expect(plot.width).toBe(figure.width);
      expect(plot.fontSizePx).toBeCloseTo(40 / 3, 12);
    }
    expect(layout[0].height).toBeGreaterThan(layout[1].height);
    const dataOnly = layoutExportPlots(sizing, [false]);
    expect(dataOnly[0].height).toBe(figure.height);
  });

  it("rejects invalid or unreadably short output without silently shrinking it", () => {
    expect(validateExportSizing(DEFAULT_EXPORT_SIZING)).toBeNull();
    expect(
      validateExportSizing({ ...DEFAULT_EXPORT_SIZING, widthMm: NaN }),
    ).toMatch(/width/);
    expect(
      validateExportSizing({ ...DEFAULT_EXPORT_SIZING, heightMm: 0 }),
    ).toMatch(/height/);
    expect(
      validateExportSizing({ ...DEFAULT_EXPORT_SIZING, fontSizePt: 7 }),
    ).toMatch(/label size/);
    expect(() =>
      layoutExportPlots(DEFAULT_EXPORT_SIZING, [false, false, false, false]),
    ).toThrow(/height of at least/);
    expect(() =>
      exportPngSize({
        ...DEFAULT_EXPORT_SIZING,
        widthMm: 300,
        heightMm: 300,
        pngDpi: 600,
      }),
    ).toThrow(/Choose 300 dpi/);
  });

  it("shares sufficient label space without changing physical size or silently squeezing a narrow frame", () => {
    const plots = layoutExportPlots(DEFAULT_EXPORT_SIZING, [false, true]);
    const compact = fitExportPlotMargins(plots, [8, 20]);
    const scientific = fitExportPlotMargins(plots, [8, 64]);
    expect(scientific[0].leftMarginPx).toBe(scientific[1].leftMarginPx);
    expect(scientific[0].leftMarginPx).toBeGreaterThan(
      compact[0].leftMarginPx!,
    );
    expect(
      scientific.map(({ leftMarginPx: _margin, ...size }) => size),
    ).toEqual(plots);
    expect(() =>
      fitExportPlotMargins(
        plots.map((plot) => ({ ...plot, width: 190 })),
        [90],
      ),
    ).toThrow(/figure width of at least/);
  });
});
