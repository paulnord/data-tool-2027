# Data Tool 2027

[Download the desktop preview for Windows, Mac or Linux](https://github.com/paulnord/data-tool-2027/releases/tag/v0.1.0-preview.1). These are development previews; see the release notes for signing and platform-testing limitations.

A small, local-data fitting application for experimental physics. Import or paste measurements, declare units and uncertainties, fit models, inspect residuals and confidence bands, and export CSV or a printable vector report.

Data Tool is an independent application extracted from the fitting companion developed in Tracker 2027. It contains no video engine, tracking workflow, decoder or Tracker UI. Tracker remains a separate project. Existing `tracker-fit-*` v1 files remain compatible. The five new nonlinear models use an explicit session v2 while retaining the `.trksess` extension; numerical requests and acknowledgments remain v1.

## Run

The macOS application builds at `src-tauri/target/release/bundle/macos/Data Tool 2027.app`. Open it normally; no `--fit` switch is needed. Startup shows an empty data table with unknown units and uncertainty. **Data… → Load file…** opens the normal file chooser, initially in the bundled Examples directory. The same ordinary CSV and session files are in `examples/data/` in this checkout. Examples contain synthetic data and are labeled accordingly; no data is generated at release startup.

```sh
npm ci
npm run dev
npm test
npm run build
npm run test:e2e
npm run test:desktop
npm run desktop:build
npm run test:integration
```

Node 22.12+ and Rust are needed for development; Tauri uses the system webview. The ignored `.tools/` directory in this working copy holds independent local toolchains. The browser development server uses port 5174 so it can run beside Tracker. The app is local-only: no backend, telemetry or data uploads.

**Data…** opens the editable source table. Units sit beneath column headings; `Time (s)` and `Height (m)` are supported CSV headings. **Export CSV…** saves the table; **Save session** retains the full analysis. **Print → PDF → Save as PDF** uses the Mac print dialog and preserves vector graph artwork and text.

Open standard Tracker `.trk`/`.trz` files to review saved point-mass positions, with calibration and original pixel columns preserved. Physical time requires an explicit uniform-timing choice; unsupported project features require a Tracker data export. See [Tracker project import](docs/tracker-import.md) and [classroom exercises](docs/classroom-exercises.md).

The model selector includes fitted decay time, fitted power-law exponent, Gaussian peaks, damped oscillations and Lorentzian peaks, with fixed/free parameters and local uncertainty diagnostics. See [nonlinear fitting](docs/nonlinear-fits.md).

See [Tracker integration](docs/integration.md), [architecture](docs/architecture.md), [extraction notes](docs/extraction.md), and the [scientific specification](docs/scientific-spec.md). The protocol schemas are in `schemas/`. Scientific test fixtures and noise generators stay under `tests/` and are not part of the production module graph.

This repository preserves the source project's license; see [LICENSE](LICENSE).

Graph mode offers linear axes, either semilog orientation (log X or log Y), and log–log. Axis labels and ticks retain the original units. This changes only the display: fitting still uses the original observations and uncertainties. Residual Y stays linear, with the same X scale as the data plot. Nonpositive observations are hidden on affected logarithmic axes with a notice; they are not automatically excluded from fitting. Intervals reaching zero are clipped at the lower graph edge. Graph mode and view range apply to printing and are window preferences, not saved session fields.

Choose **Analysis → Collision · before and after** for four position components against shared time. Drag shared before/after boundaries, fit all eight lines, and use the usual Copy report and Print buttons. Position uncertainties have explicit estimate/supplied modes. Switching analyses preserves both setups for the same source table. Try `examples/data/collision.csv`. This draft does not yet save collision setup in sessions; see [scope and rollback notes](docs/collision-draft.md).

The **Accept uncertainty assumptions** checkbox sits directly below Fit in both analysis views. Hover or focus its label for a short checklist; click it for an offline fitting guide with NIST references. The checklist stays clear of the label and supports selecting and copying text; Escape or a click elsewhere dismisses it. Reading the guide does not accept assumptions or change the fit. External reference links open only on request in the system browser.

**Analysis → Custom equation…** accepts expressions such as `y0 + v0*t + 0.5*a*t^2`, with named parameters, starting values, fixed/free controls and case-sensitive units. **Edit as custom equation** starts from any built-in fit. Affine equations use QR; nonlinear equations use a local optimizer with the usual diagnostics. Custom sessions use explicit v3 while older formats remain readable. See [syntax, workflow and limitations](docs/custom-equations.md).

Choose **Analysis → Multi-interval fit…** for one to four curves across up to three student-selected ranges. Select each range on the graph, choose its equation, and fit it explicitly. Results and residuals remain available together; copy the report for spreadsheet calculations or print a compact overview with optional detail pages. Ordinary examples include `cart-track.csv`, `bounce-intervals.csv` and `oil-drop-intervals.csv`. This draft keeps setup while switching analyses but does not yet save multi-interval sessions. See [workflow and scope](docs/multi-interval.md).

For recommended browser hosting, executable downloads and future OSP inclusion, see [distribution plans](docs/distribution.md).
