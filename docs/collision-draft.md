# Collision analysis draft

This is an optional review prototype. The normal single-fit analysis remains the default. **Analysis tools → Collision · before and after** opens an integrated workspace with assignments and fit controls on the right. If columns are missing, use the usual **Data…** button to load or edit them. Load the ordinary `examples/data/collision.csv` file to try it.

Choose one time column and four position columns, assigned to the x and y components of two objects. Starting intervals cover the outer 40% of the time span; they are only suggestions, not collision detection. Adjust both intervals to exclude the impact. Drag a dashed boundary on any position graph to update all four panels, use Left/Right arrow keys on a focused boundary, or enter exact times in the sidebar. All panels share the same time range, including when a position column has missing values. Endpoints are included and intervals must be disjoint. **Fit before and after** runs independent line fits with the existing QR scientific core in a worker. Missing values affect only the corresponding channel; a failed fit is reported without hiding successful fits.

The velocity summary shows the eight slopes, units and standard errors when available. Four aligned position graphs show the two intervals with colors and solid/dashed model lines. Residuals and detailed tables include intercepts, standard errors, slope 95% intervals, sample counts, degrees of freedom, RMS residuals, rank and inference warnings. The usual Copy report and Print controls act on the active analysis. Printing defaults to the summary and four graphs; **Include fit details when printing** adds the complete appendix even if it is collapsed on screen. Each component begins on a fresh page and keeps its residual plot, fit table and explanation together: one summary page followed by four component pages. Source notes remain with the summary. Copying exports a spreadsheet-ready tab-separated layout: a four-row velocity summary, the raw time and four position columns with a Before/After/Exclude phase column, uncertainty metadata, and the full diagnostic report to the right. See the clipboard layout below.

Each column starts with unknown equal scatter, estimated separately for each interval. Choose **Enter position uncertainties** to enter a positive common sigma for each column in its own units. Return to **Estimate scatter from residuals** to stop using those values; entered values are retained when switching uncertainty modes. This prototype does not map per-row uncertainties to the four channels. It does not inherit the single-fit view's exclusions. Known-false exact-time assumptions and known-false independence/correlation for the matching source channel continue to block inference. Conditional uncertainties require explicitly accepting exact time, independent Gaussian errors and straight-line motion within each interval. Neither interval-selection uncertainty nor covariance between fits is modeled. The app does not compute momentum, energy or conservation claims.

Changing a column, interval or uncertainty clears the draft results and disables report export until another fit completes. Returning to the single-fit view preserves that analysis. Switching between single-fit and collision analyses preserves both setups and results while the source table and observations are unchanged. Editing or replacing the source data starts a fresh collision setup. There is no automatic merging of multiple Tracker tracks: supply a table containing all five columns, such as CSV.

## Persistence and compatibility

**Save session** writes the complete source table and active collision setup in a
v7 `.trksess`: all five column assignments, both windows, uncertainty mode and
values, assumption acceptance, plot limits and detail preferences. Reopen it
through Data review, then press **Fit before and after** to recalculate results.
Invalid column assignments, windows or uncertainties block saving. Reports are
still copied or printed separately. See the [current format](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15);
request/ack v1 remains unchanged; only session v7 is supported.

## Rollback

Pre-draft copies of `src/fit/FitApp.tsx` and `README.md` are in the ignored `.tools/rollback-collision-draft/` directory. All implementation is isolated to the following additions plus the launch control in `FitApp.tsx` and the README link:

- `src/core/fit/collision.ts`
- `src/fit/CollisionDraft.tsx`, `src/fit/collision.worker.ts`, `src/fit/collision.css`
- `tests/fit/collision.test.ts`, `e2e/collision.spec.ts`
- `tests/support/generate-collision-example.py`, `examples/data/collision.csv`
- This document

To roll back, restore the two pre-draft files and remove these additions, then rebuild the app. If other edits have happened since this draft, remove only the draft's changes rather than overwriting those edits. The backup excludes generated app bundles; rebuilding restores the prior UI.

## Integrated-workflow rollback checkpoint

The previous modal draft is preserved in `.tools/rollback-collision-workflow/` (FitApp.tsx, CollisionDraft.tsx, collision.css, collision.spec.ts, README.md and this document). The other browser tests only rename the model selector label from Model to Analysis. No scientific solver or protocol schema was changed by the integrated workflow.

Printing uses normal block flow in document order, with legacy and modern page-break properties. The collision print ancestors disable flex layout and CSS containment for the Mac webview. Browser PDF checks cover the expected five pages; native printer pagination still needs checking in the Mac print dialog.

## Clipboard layout (collision-worksheet-v1)

Paste once at A1 of an empty sheet (clear the previous pasted region before replacing it with a shorter dataset). The source table and fits are not changed. This is an export layout, not a new session format.

- A1:H5: headings and four summary rows, ordered Object 1 Before, Object 2 Before, Object 1 After, Object 2 After. Columns are Object, Phase, vx, σ(vx), R² x, vy, σ(vy), R² y. Velocity and standard-error headers include actual units. Values retain full numerical precision; unavailable statistics remain explicitly unavailable rather than becoming zero.
- A6: uncertainty/selection explanation and a warning if the data are not all in metres and seconds. No units are converted. If objects use different units, both are stated in the summary header. Match the destination's units before using the values.
- A8:F8: raw-data headings; A9:F…: original time and all four position columns, in source order, followed by Phase. All source observations are retained, with no 100-row limit. Phase uses the actual shared fit selections, including interval endpoints; every point outside both windows is Exclude. Missing or invalid positions remain visible and exclude only their own component. Phase describes a time selection, not a claim that every axis was usable or its fit succeeded. Overlapping/divergent selections cannot be exported as one phase column.
- J1:O5: object/axis mapping to original source column labels, position units, actual uncertainty method, and supplied position sigma when applicable. Residual-based slope errors and supplied-position-precision slope errors are not interchangeable. Both continue to require the app's existing inference assumptions; copying does not accept them.
- J7:L9: inclusive before/after time windows; J11:K11: raw row count; J12:K12: format identifier.
- Q1 onward: full fit report, including uncertainty reasons, fit failures, warnings, and R². Print and the existing detailed-fit display remain available.

Object 1/2 are the pairs assigned in the collision workspace. Original position labels are preserved in metadata and the full report. The summary does not add masses, momentum, energy, or conservation calculations. Numeric text is not rounded; text labels/notes that could be interpreted as spreadsheet formulas are escaped.
