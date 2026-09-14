# Data Tool 2027 — program and rebuild specification

**Baseline:** v0.3.0, September 2026, with the subsequent residual-visibility, Settings, axis, print-orientation, physical export-sizing, model-guide, model-comparison, and source-code-export revisions in this checkout described below. **Audience:** a future implementation team or coding agent rebuilding the application while preserving its scientific meaning and existing files.

This document describes the program at that baseline and the constraints a better implementation must preserve. It is a product and behavior specification, not a requirement to reproduce the present component structure or every incidental visual detail. A successful rebuild makes the workflow easier to understand, simplifies the implementation, and retains the numerical and interoperability contracts.

The terms in this document distinguish three kinds of statement:

- **Invariant / MUST:** a requirement to retain unless an explicitly approved, documented migration changes it.
- **Current behavior:** a feature or limitation implemented at the baseline above. The corresponding tests and source provide executable detail.
- **Proposed:** a direction for the next implementation, not a claim that the release already provides it.

Read this specification with [numerical methods](numerical-methods.md), [nonlinear models](nonlinear-fits.md), [custom equations](custom-equations.md), [integration and version migrations](integration.md), and the strict [interchange schemas](../schemas/). The older [scientific specification](scientific-spec.md) contains important scientific requirements but is a historical development draft: its initial feature scope and implementation-status links do not describe the current release. Repository [AGENTS.md](../AGENTS.md) remains the contribution policy; this document does not silently amend it.

## 1. Purpose and boundaries

Data Tool is an independent application for inspecting numerical observations, selecting data, fitting mathematical models, assessing residuals and uncertainty, and producing reusable results and figures. A person with a local spreadsheet, instrument export, Tracker dataset, or saved session should be able to work without writing code. The primary workflow should also be understandable to a first-time user.

The application is general-purpose numerical analysis software. Guidance explains the implemented methods, assumptions, diagnostics, and limitations in accessible language. It MUST NOT make unsupported certification or blanket standards-compliance claims, turn fit success into evidence that a physical model is true, or require a particular course or lab-report assignment.

**Invariants:**

- Observations, fitting, and file conversion remain local. There is no account, measurement upload, telemetry, collaboration server, or background network analysis service.
- The scientific core is independent of React, the DOM, storage, file dialogs, native APIs, and test-data generators.
- Tracker remains a separate application. Data Tool has no video engine, video decoder, calibration editor, or embedded Tracker UI. Tracker and OSP repositories are reference material, not modification targets.
- A new analysis starts with an empty table, unspecified units, and unknown uncertainty/inference assumptions. No sample or fit appears without a user action.
- No automatic outlier removal, automatic fit on import, or undisclosed transformation of observations is permitted.

**Current delivery:** a React/TypeScript browser application and a small Tauri/Rust desktop host. The browser build is statically hosted and downloads application assets; it does not upload selected files. Opening or reloading that build requires a connection because offline startup is not implemented. The release workflow builds packages and runs native host tests on macOS, Windows, and Linux; v0.2 completed those automated checks. Local desktop interaction has been exercised on macOS. Automated packaging is not a claim of interactive validation on every supported platform or operating-system version.

## 2. Canonical data and analysis state

### 2.1 Observation identity and precision

The canonical numerical input is a versioned immutable request snapshot. It carries request/snapshot UUIDs, dataset identity, source application/version and available provenance, explicit X/Y column identities and labels, nullable unit labels, uncertainty declarations, and ordered rows with stable unique IDs. UUIDs are opaque identities, not claimed content hashes.

Each numerical observation is a finite IEEE-754 binary64 value or an explicit missing value. Missing X or Y requires a missing-value reason and cannot be included in a fit. NaN and infinity are invalid interchange values. Numeric table cells accept decimal/scientific notation; grouped numbers and hexadecimal are not silently reinterpreted. Repeated X values are legitimate observations and MUST NOT be merged. Sorting for rendering MUST preserve row identities, inclusion, and uncertainty associations.

The source table retains its textual cells, headings, column mappings, unit declarations, and row identities separately from the selected numerical X/Y snapshot. Extra columns and textual information remain available when a user changes assignments. Display rounding MUST NOT replace stored numerical values or source cell text. A CSV export may update headings to express current units; a session retains the richer analysis information.

Observation tables, graph tooltips, and copied fit reports use human-readable row numbers: the 1-based position in the complete observation list, excluding headings. Excluded or missing observations leave gaps in fitted-result tables instead of renumbering the fit subset. Internal UUIDs and imported row IDs remain unchanged for selection, undo, and session compatibility; they are not displayed as row labels.

### 2.2 Units and provenance

Units are explicit, case-sensitive labels. Unknown units remain unknown. Labels such as `m`, `mH`, `ms`, and `1` are not interchangeable: `1` can explicitly denote dimensionless, and an empty entry means unspecified. Unit fields MUST disable capitalization, autocorrection, spell-checking, and autocomplete. Editing a unit label does not rescale observations. There is no general unit conversion or dimensional-analysis engine.

Built-in parameter units follow the equation and declared axis units. Custom parameter units are supplied explicitly. The constant-acceleration model requires the user to confirm that the selected independent variable represents physical time; frame rate or timestamps are not inferred merely because the model is selected.

Source identity, notes, calibration/timing assumptions when present, and the original request when retained must survive validated round trips. Imported or derived numerical quantities MUST NOT be relabeled as newly measured raw observations. Long source notes remain complete in saved files, technical reports, and printed appendices.

### 2.3 Three distinct state categories

The implementation MUST distinguish:

1. **Scientific inputs:** observations, assignments, inclusion, model, starting/fixed values, uncertainty, and acceptance of inference assumptions.
2. **Derived computation:** fit coefficients, residuals, diagnostics, covariance, and the specific input revision that produced them.
3. **Presentation preferences:** interface scale, plot colors/markers, visible axis ranges/scales, confidence-band/error-bar visibility, residual-plot visibility, report-section choices, print layout, and physical figure-export settings.

Current presentation preferences are held in the running window and are not stored in `.trksess`. Changing appearance or axis view does not change observations or trigger an optimization. An old result cannot appear current after its scientific inputs change. Sessions save inputs and settings, not a trusted cached fit result.

## 3. Main workflows

### 3.1 Start, load, inspect, apply

The first file-oriented action in the main toolbar is **Data…**. It opens a data workspace that supports **Load file…**, pasted spreadsheet data, a new table, editing, column assignments, and **Export CSV…**. Supported file types are `.csv`, `.tsv`, `.txt`, versioned `.json` and `.trksess`, and read-only Tracker `.trk`/`.trz` inputs.

Loading is a staged operation. A user first reviews the source table, header rows, selected X/Y columns, optional Y-uncertainty column, units, missing values, and errors, then chooses **Use these data**. **Cancel** preserves the active analysis. A malformed or unsupported file MUST NOT replace valid work. Replacing an edited table draft offers an explicit keep/discard choice; replacing unsaved analysis work likewise offers **Keep working** or **Discard changes**.

Current table operations include rectangular selection, Shift selection, column selection, copying/pasting blocks, direct text editing, clearing cells, deleting rows/columns through the context menu, adding columns, and table undo/redo. Changes to column position must keep assignments attached to their intended data. Header rows are explicit; a final parenthesized heading suffix such as `Time (s)` may declare a unit. Ambiguous heading alignment is presented for correction rather than silently guessing away a data column.

Keyboard row navigation and Shift-selection continue across table pages without losing focus. Shortcut guidance covers Command and Control keyboards. Undo in an editable text field stays in that field; analysis undo/redo is available once in the main toolbar. Temporary menus close on outside click or Escape without discarding the surrounding data draft.

The current interchange request limit is 100,000 rows. Ordinary text file import is limited to 20 MB. Tracker archive import is bounded separately as described below. A limit failure must identify the problem without partially applying data.

**Examples:** the Data workspace has an Examples selector for bundled ordinary files, including published-data `.trksess` sessions. Synthetic data and Published data are separate visible categories with item counts and an explicit scrolling cue. Each choice uses the ordinary import/review path, and startup stays empty. The user explicitly requested this selector and its September 2026 reorganization. That task-specific authorization takes precedence over the general no-menu wording still present in `AGENTS.md`; this specification records the implemented behavior without rewriting the contribution policy.

### 3.2 Fit and inspect

Select the analysis/model, inspect its equation and parameter table, enter or fix values, choose the uncertainty treatment, select observations, and explicitly press **Fit selected observations**. Selecting a nonlinear model can suggest starting values; that is not an optimization or evidence of convergence.

Parameter values and the supplied sine period accept incremental decimal/scientific notation, including an incomplete minus sign or exponent while typing. Only finite valid values reach the analysis state. Fit, save, copy, and print are disabled during an incomplete entry; Escape restores the last valid value, and leaving an invalid field restores that value with an explanation.

The graph and fit controls remain visible together at ordinary desktop dimensions. The user sees a clear state such as ready, fitting, manual preview, fitted, or results stale. Parameter edits may produce an explicitly labeled manual preview; they MUST NOT masquerade as a new optimized result. Fits run in workers. Cancelled, failed, or superseded computations cannot overwrite a newer analysis or result.

Individual point inclusion and graph-region selection are reversible and retain exact observations. Current graph gestures select a region, Shift-drag adds, and Option/Alt-drag excludes. Numerical coordinate selection, row identities, and missing values must stay consistent across data and residual displays. Selection after inspection is recorded as a boolean flag and its inferential limitation disclosed; v0.3 does not save a complete chronological selection-history log.

The results expose parameter values, fixed/free state, units, standard errors and marginal intervals when available, sample count, rank, degrees of freedom, residual statistics, inference status, warnings, and parameter correlations. Observations and residuals remain inspectable. A user should be able to understand why an uncertainty or statistic is unavailable without interpreting an internal exception trace.

Known unavailable-statistic codes are explained in ordinary language in the interface, printed tables, and copied reports. The underlying result codes remain unchanged. Snapshot identifiers are available under a collapsed technical disclosure rather than mixed into the normal source description.

### 3.3 Save, reopen, and report

**Save session** creates a validated self-contained `.trksess` with source data and current settings. Reopening passes through review and restores inputs/settings; fitting is explicit. The browser downloads files; the native host uses local file dialogs and bounded/atomic file operations. Cancelling a dialog does not imply failure or discard work.

**Copy report** copies the current analysis as spreadsheet-friendly tab-separated sections. **Print** opens the single-fit report preview or the active draft analysis's print workflow. **Export graph** creates figure files, separate from the complete report. The distinctions must be visible in the names, not hidden in special-case dialogs.

## 4. Models and numerical contract

The current single-fit catalog has 16 built-ins plus custom equations. Preserve model identifiers and physical parameter meaning; presentation labels may improve. Parameter order, defaults, domain validation, and unit derivation are defined in [schema.ts](../src/core/fit/schema.ts), [solve.ts](../src/core/fit/solve.ts), and [nonlinearModels.ts](../src/core/fit/nonlinearModels.ts).

| Family / identifier             | Equation or role                                      | Important distinction                                                               |
| ------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `line`                          | `b + m*x`                                             | Intercept and slope.                                                                |
| `quadratic`, `cubic`, `quartic` | Polynomial through degree 2, 3, or 4                  | Coefficients remain in the declared physical basis.                                 |
| `constant-acceleration`         | `y0 + v0*t + a*t^2/2`                                 | Explicit confirmation of physical time.                                             |
| `logarithmic`                   | `b + a*ln(x/xref)`                                    | Positive X; `xref` is one declared X-unit.                                          |
| `reciprocal`                    | `b + a*xref/x`                                        | The current implementation requires positive X; same explicit reference convention. |
| `exponential`                   | `b + a*exp(k*x)`                                      | Supplied rate `k`; amplitudes are linear fit parameters.                            |
| `power-law`                     | `b + a*(x/xref)^p`                                    | Supplied exponent `p`, positive X.                                                  |
| `sine`                          | `b + s*sin(2*pi*x/T) + c*cos(2*pi*x/T)`               | Supplied positive period; linear amplitudes/background.                             |
| `sine-free-period`              | Same sine equation with fitted period                 | Bounded frequency search, competing-basin and boundary diagnostics.                 |
| `exponential-decay`             | `b + A*exp(-x/tau)`                                   | Fit positive decay time, not a general growth rate.                                 |
| `power-law-free`                | `b + A*(x/xref)^n`                                    | Fit the exponent; positive X.                                                       |
| `gaussian`                      | `b + A*exp(-0.5*((x-mu)/sigma)^2)`                    | Positive peak width; width is not measurement sigma.                                |
| `damped-sine`                   | `b + exp(-x/tau)*(s*sin(2*pi*x/T) + c*cos(2*pi*x/T))` | Positive period/decay time; local nonlinear fit.                                    |
| `lorentzian`                    | `b + A/(1+((x-mu)/gamma)^2)`                          | Positive half-width; full width is `2*gamma`.                                       |
| `custom`                        | User-supplied restricted expression                   | Explicit parameter names, units, starting values and fixed flags.                   |

### 4.1 Solvers and diagnostics

Residuals are observed Y minus predicted Y at the original X. With unknown equal scatter, minimize SSE. With supplied standard uncertainties, minimize the sum of squared residuals divided by the supplied variances. Logarithmic plotting does not log-transform the fit objective.

Models linear in free parameters use column-scaled, pivoted, twice-reorthogonalized QR; subtract fixed contributions before solving. Do not explicitly invert normal equations. The current normalized rank threshold is `1e-12`. Report numerical rank and the defined conditioning diagnostics, and transform parameters/covariance back to the physical basis. The current `diagonalRatio` is a ratio of scaled QR diagonals, not a matrix condition number; a ratio above `1e8` produces a warning, not a separate hard failure cutoff. Rank loss cannot produce a supposedly unique fitted parameter vector with ordinary uncertainty.

Nonlinear built-ins use analytic Jacobians and scaled damped Gauss–Newton steps in Levenberg–Marquardt form, solved with QR. Final rank/covariance use the undamped physical Jacobian. Free-period sine has a separate bounded search. Local minima, boundaries, invalid domains, floating-point failure, and iteration/evaluation limits remain explicit. A fit that reaches its work limit is not reported as successful merely because a curve can be drawn. Detailed algorithms and validation regimes are in [nonlinear-fits.md](nonlinear-fits.md).

**Invariant:** changing solver libraries or reorganizing the implementation requires scientific regression evidence. Preserve original observations, free/fixed parameter meaning, objective, rank definition, uncertainty scaling, and reasons for unavailable results. Better-looking plots are not validation of a numerical change.

### 4.2 Uncertainty and inference

Uncertainty is a strict choice among unknown equal scatter, a supplied positive common Y standard uncertainty, or supplied positive per-row Y standard uncertainties linked by row ID. Every included row requiring a supplied uncertainty must have one. Invalid or partly missing supplied uncertainty MUST NOT silently fall back to residual-estimated scatter.

Record error structure separately from assumptions concerning exact X, independent Gaussian Y errors, and the correct model/fixed values. Each assumption can be asserted, unknown, or known false. Unknown assumptions default to descriptive-only behavior; explicit conditional acceptance permits supported inference without relabeling unknown source metadata as verified. Known false assumptions and known correlation block unsupported inference. Contradictory declarations are validation errors.

For numerical rank `r` and `n` included valid rows, residual degrees of freedom are `n-r`. Supplied absolute uncertainties determine covariance without forcing reduced chi-square to one. Unknown common variance is estimated with SSE divided by residual degrees of freedom when available. Standard errors and marginal 95% parameter intervals must have distinct labels; known-sigma linear intervals use normal quantiles and residual-estimated linear intervals use Student-t quantiles. All-fixed analyses evaluate residuals without estimating parameter errors.

Inference output retains these limits:

- Pointwise 95% mean-curve bands are neither prediction intervals for observations nor simultaneous confidence bands.
- Free nonlinear parameters use local Jacobian approximations. Their Q is withheld under the implemented nonlinear reference-distribution rule; fixing nonlinear shape parameters can restore linear inference where supported.
- Q is a chi-square upper-tail probability under the stated conditions, not the probability that the model is true. It is unavailable when noise is estimated from the same residuals.
- Centered R² is descriptive, may be negative, and does not prove model adequacy. Weighted fitting does not make it a weighted R².
- Fixed parameters have no estimated parameter error. Zero degrees of freedom, zero residual variance, rank loss, and other unsupported cases retain explicit availability reasons rather than plausible-looking zeros. With supplied absolute sigma and zero residual degrees of freedom, covariance can remain available while Q and the reduced objective are unavailable. In unknown-equal mode with positive residual degrees of freedom, zero SSE reports zero scatter but suppresses intervals with `zero-residual-scale`; it is not evidence of perfect parameter precision. With zero residual degrees of freedom, estimated scatter remains unavailable.
- Intervals do not account for choosing models, ranges, or exclusions after looking at the data, nor for uncertain calibration, fixed values, or a complete measurement uncertainty budget.

Parameter correlation is derived from covariance as `Cij/sqrt(Cii*Cjj)`. It is a **parameter correlation matrix**, not an observation cross-correlation calculation or covariance between independent interval fits. Fixed/zero-variance terms and unavailable covariance remain unavailable, not invented zeros.

### 4.3 Custom equation editing

The editor accepts a right-hand-side expression, an independent-variable identifier, and 1–8 parameters ordered by first occurrence. Existing built-ins can be converted with **Edit as custom equation**, retaining current values and fixed controls. New parameter names receive an initial value and unknown unit; retained names retain their settings. **Apply equation** validates and commits the draft, invalidates the old fit and accepted assumptions; discarding edits restores the applied equation. Fit, Save, Copy report, Print, and graph export are disabled in the single-fit workspace while uncommitted equation edits exist; the graph status identifies the pending equation.

The expression parser MUST remain a restricted AST interpreter, never JavaScript evaluation. It supports explicit arithmetic and the documented functions/constants, with automatic differentiation. No assignments, property access, random functions, or code execution are accepted. Current bounds include 1,000 characters, 256 tokens, 48 parser nesting levels, and 64-character identifiers. Function/domain rules, precedence, radians, and the exact language are specified in [custom-equations.md](custom-equations.md).

A conservative structural test routes affine dependence on free parameters to QR; otherwise the nonlinear solver is used. A domain error at an included observation blocks fitting and identifies the observation. Invalid trial steps are rejected. Drawing omits invalid curve segments instead of connecting across a discontinuity. There are no general parameter bounds or automatic dimensional checks in v0.3.

## 5. Interaction and display

### 5.1 Findable controls without proliferating special menus

The main toolbar groups **Undo**, **Redo**, **Display**, and **Settings** on the left. Its file/output group on the right is **Data…**, **Save session**, **Copy report**, **Print**, and **Export**. Undo/redo have visible text and recognizable arrows rather than indistinguishable tiny icons. Availability must reflect actual undo history and valid operations. Multi-fit workspaces disable main analysis history.

**Display** holds interface size and graph appearance together. **Settings** separates global graph visibility from single-fit copy-report sections. **Show residual plots** defaults on and **Show fit guides when available** defaults off; the full-page print preference is available only in Print preview. Axis-specific choices live beside the relevant graph, not in a second general-purpose settings layer. Menus close on outside click or Escape; keyboard dismissal returns focus to their trigger. Action menus support arrow-key navigation. Modal shortcuts stay within the active dialog; closing Data, Figure size, or Print preview restores a visible invoking control. Help text follows interface scale. Popovers must remain reachable on a small laptop at enlarged interface scale.

These groupings express a product principle for a rebuild: put the common action where the user first looks, then expose detail in context. Do not add another permanent toolbar or specialized options panel for every dataset, model, output destination, or teaching scenario.

### 5.2 Plot geometry and selection

The data graph and its residual graph MUST use the same numerical X domain and exactly aligned inner frame edges. Compare the plotting rectangles, not merely their SVG element widths. A fitted pair shares the X ticks and label at the bottom of the residual plot; a data-only plot retains its own X axis. Residuals include a visible zero reference and use a linear residual Y scale.

Turning **Show residual plots** off removes residual graphs from every analysis mode, print workflow, and figure export. Their vertical space belongs to the main data graphs, which retain X ticks, labels, and units. This preference MUST NOT remove residual values or diagnostics from numerical results, change fit inputs, or trigger a refit. Turning it on restores the paired layout.

The residual graph is deliberately shorter, roughly one-third of the data frame height in the standard and full-page print layouts. The gap is tight and consistent. Space recovered by removing a duplicate X axis belongs to the data graph. A rebuild may adapt dimensions responsively, but must not reintroduce unrelated aspect ratios, large dead space, or a residual strip too short to inspect.

Markers remain centered on exact observation coordinates, retain point identities and keyboard/pointer behavior, and distinguish excluded or out-of-range data. Supplied Y error bars represent ±1 standard deviation and appear only when appropriate; unknown residual scatter is not substituted as a measurement error bar. The band toggle and **Pointwise mean interval · assumptions** disclosure sit next to each other, so checking the band does not move or resize the graph to accommodate explanatory text.

Matching **X axis** and **Y axis** triangle menus in every analysis mode expose zoom controls, minimum/maximum limits, and **Auto**. Single-fit menus also offer logarithmic scales; the multi-interval and collision drafts remain linear. Auto restores only that axis’s automatic range, not the fit or observation selection. X view changes propagate to all related data and residual graphs, printed output, and exports. Scientific interval endpoints and the raw-data bounds used by selection controls remain unchanged. Manual limits are used exactly, without automatic padding, and invalid limits remain editable with a specific message.

For nonconstant values, automatic X ranges add 6% of the data span at each end; automatic data-graph Y ranges add 12% of the plotted span at each end. Y ranges include the displayed curve, band, and error bars where present. On logarithmic axes, padding is measured in log coordinates so positive extrema have comparable visual breathing room. Constant values receive a centered range in the relevant axis coordinates; empty and extreme numeric cases have finite fallback/bounded ranges. Zero is not an implicit datum on the data axes. Residual ranges include their zero reference; single-fit residual ranges are symmetric about zero. Whole markers should remain inside automatic plot frames.

Single-fit and multi-interval fitted curves distinguish the span supported by actual fitted observations from short extrapolated ends. Extensions reach up to 10% beyond that span, remain clipped to the current viewport, and use thinner, fainter dashed strokes. Positive spans on logarithmic X axes measure extension length in log coordinates; spans crossing zero use their physical X width without changing the fit's support. Interior excluded observations do not split a curve into extra extensions. Confidence bands stop at the fitted span, and residuals remain actual observations. For single-fit damped oscillations, **Show fit guides when available** controls one guide at the fitted offset **b** and the amplitude envelope; the baseline has a compact value label. Multi-interval damped fits retain their dotted **b** guides, with an interval number when needed. Automatic Y limits include visible guides and the supported curve but exclude extrapolated fitted-curve tails. Print and graph exports preserve these marks, aligned frames and shared axes.

Nonpositive observations hidden by a log display and clipped uncertainty intervals are disclosed; hidden observations remain scientifically included unless explicitly excluded. View changes never silently redefine the fit sample.

### 5.3 Appearance preferences

Current interface scales are 100%, 125%, 150%, and 200%. Graph controls offer three palette choices (blue/orange, green/purple, black/gray), small/medium/large markers, and circle/open-circle/square/diamond/triangle marker styles. A compact sample explains data versus fit appearance. **Reset appearance** restores graph defaults and keeps interface scale.

Appearance propagates to single fits, draft analyses, printing, and figure exports. Solid markers have no white halo that blanks the data beneath them. Open circles have transparent centers. Changing marker shape or size must preserve the exact observation location and picking behavior. Color alone must not be the sole signal for an observation's inclusion or an interval boundary.

### 5.4 Model guides and derived oscillation quantities

Guides are model-provided presentation references, not arbitrary user equations or extra fitted components. The damped-sine model currently provides a baseline `y=b` and the symmetric envelope `b ± sqrt(s²+c²) exp(-x/tau)`. In the single-fit workspace, **Show fit guides when available** defaults off and controls both the baseline and envelopes, with exactly one baseline when enabled. These muted dotted/dashed guides remain subordinate to the fitted curve, affect automatic displayed Y bounds when visible, and carry through printing and figure/code exports. Multi-interval plots retain their existing labeled **b** guides independently of this single-fit preference. The preference is not saved in the strict session schema and never triggers a fit.

Sine-family fits report amplitude, phase and frequency. First-order standard errors use the complete covariance; phase is relative to the current X origin and unavailable at zero amplitude, without an absolute threshold in the chosen Y units. The interface does not draw separate sine and cosine contributions because those components also change under an X-origin shift. Detailed equations are in [model comparison, guides and code export](model-comparison-and-code-export.md).

## 6. Reports, print preview, and reusable figures

### 6.1 Copy reports

The single-fit **Settings** menu exposes statistics, parameter correlations, observations/residuals, and source/notes sections. Parameter/model information and essential inference context remain part of the report. **Compact report** includes statistics and correlations while omitting the observation and provenance sections; **Technical report** includes all four sections. These selections affect copying, not a scientific computation or session format. Their group is labeled for single-fit reports and disabled in collision and multi-interval modes, where those section choices do not apply.

Copy output preserves numeric precision independently of print/display rounding, handles tabular text safely, and identifies unavailable statistics with reasons. Spreadsheet-compatible escaping and provenance retention are part of the reporting contract. Collision and multi-interval drafts have their own full reports; the single-fit section choices are not a claim of a shared report editor for all modes.

### 6.2 Single-fit print preview

Current single-fit printing targets US Letter portrait paper with half-inch margins. The preview shows separate paper sheets, page edges, and **Page N of M** labels in both standard and full-page modes. Those labels are preview furniture, not a claim that the printed report has page-number footers. The measured paginated content is reused as the print DOM, so page boundaries are not merely decorative guidelines over an unrelated layout.

**Print** opens the preview; **Print…** invokes the browser/system print dialog. **Close preview**, Escape, or a click outside the preview closes it. Clicking inside its padding is not an outside click. A directly visible **Full-page graph** checkbox updates the preview immediately. It is not duplicated in Settings.

Standard mode places the graph and report blocks on successive measured sheets as needed. Full-page mode uses one landscape-shaped graph composition rotated counterclockwise (−90°) as a unit onto the first portrait sheet, with the figure’s top along the left paper edge; all remaining report information starts on subsequent upright sheets. The user keeps printer orientation **Portrait**. Do not use a mixture of named landscape and portrait CSS pages, require a printer orientation change, or rotate only one of the two plots.

With residuals visible, both graph modes preserve identical inner plot widths, tight spacing, one shared lower X axis, and a shorter residual frame. With residuals hidden, the data graph fills the combined graph height and retains the X axis. Long titles or notes may require uniformly scaling a whole composition. They must not independently scale the two SVGs or clip labels. Tables can split with repeated headers; warnings and source notes stay readable and complete. A parameter correlation matrix, five-parameter nonlinear table, custom equation, and long source appendix must all fit without horizontal overflow.

Current print number formatting is intentionally more compact than copied numerical data: approximately seven significant digits for values and four decimal places for correlations. This is presentation only. The preview, browser-produced PDF, and actual system print path all matter; DOM bounding boxes alone are insufficient evidence that printing looks correct.

### 6.3 Figure exports and LaTeX

The top **Export** menu offers **SVG vector graphic**, **PDF vector graphic**, **PNG image**, **Figure size…**, and a SciPy/ROOT analysis bundle for a current single fit. Figure export acts on the active analysis, rather than a hidden single-fit plot. Visible graphs are stacked into one figure with aligned inner frames. For draft modes, export selection follows their visible overview/expanded graph state and avoids duplicated hidden diagnostic plots.

| Format | Current output                                                                                                               | Intended use / limitation                                                                                                                                         |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SVG    | Self-contained vector geometry, text and resolved presentation styles; white background                                      | Editable artwork. Fonts/styles can be adjusted in a vector editor. The file is not a LaTeX-native plot.                                                           |
| PDF    | Cropped vector figure with embedded DejaVu Sans; physical page dimensions when configured                                    | Direct insertion into a LaTeX/Overleaf paper; no report-sized blank paper margin. LaTeX sizes and places it but does not restyle its internal text automatically. |
| PNG    | Rasterized figure at configured 300/600 dpi with physical-resolution metadata; otherwise up to 3× displayed graph dimensions | Systems that require raster images; does not preserve editable vector text or infinite enlargement. Memory/dimension bounds apply.                                |

**Figure size…** is an opt-in export preference. Until a user applies it, quick format exports retain their existing display-sized behavior. The dialog provides editable **Single column · 85 × 60 mm**, **Double column · 170 × 100 mm**, and **Custom** sizes, independent width/height fields, final label size, and PNG resolution. Labels default to 9 pt; current limits are 8–14 pt, width 50–300 mm, and height 40–300 mm. PNG choices are 300 and 600 dpi, with the resulting pixel dimensions shown before export. Presets are starting points, not per-journal compliance profiles. Cancel or invalid input preserves the previous applied configuration.

Sized exports redraw the active figure at its requested geometry instead of stretching a screen capture. Labels and markers retain their physical size as aspect ratio changes; data and residual frames remain aligned. Residual visibility applies to these figures, and hiding residuals reallocates height to the data plots. SVG declares width and height in millimetres, PDF uses corresponding page dimensions, and PNG rounds the requested physical size to pixels and includes matching resolution metadata. A requested layout too short for its graph count and label size fails with guidance to increase the height or hide residuals. PNGs exceeding the current 32-million-pixel or 16,384-pixel-side bounds fail explicitly rather than silently lowering the chosen resolution. Line-width and font-family controls are not currently offered.

PDF is the straightforward current paper workflow: load `graphicx` in LaTeX and use `\includegraphics[width=\linewidth]{graph.pdf}`. Choose the intended final physical dimensions before export; additional LaTeX scaling also scales the labels. SVG is the editable source when publication typography or line styles need further work. The program does not claim universal journal compliance. A future PGF/TikZ exporter remains only a possibility.

Exports retain axis units, signs and Unicode scientific labels, marker appearance, exclusions, visible bands/error bars, and current view. Export conversion is local. SVG content must not depend on application CSS, viewport-specific layout rules, scripts, or temporary selection rectangles; clip IDs must be unique and references local. PDF font conversion must preserve legible glyphs. Export failures produce a useful message without changing the analysis.

Physical-size exports reserve one shared left margin for the widest Y tick label, including scientific notation. Operational notices about unavailable curves, confidence bands, or error bars stay visible in the application and are repeated in the export status; SVG also retains them as descriptions. They are not drawn across the publication figure, and unavailable elements are never fabricated.

### 6.4 Reproducible analysis bundle

A current single fit exports one versioned ZIP archive with a containing directory and five files: `data.csv`, `analysis.json`, `fit_scipy.py`, `fit_root.C`, and `README.md`. Observations MUST remain data rather than generated source literals. The CSV preserves full-precision X/Y/sigma values, blank missing values, row identities, explicit inclusion state, and missing reasons. JSON records provenance, units, assumptions, uncertainty treatment, equation/settings, original starts/fixed parameters, applicable bounds, the Data Tool solution for comparison, visible graph choices, and expected output names.

Both programs read `data.csv` at execution and accept another compatible CSV path without regeneration; stored Data Tool coefficients are compared only for the bundled reference inputs. Each program refits, prints diagnostics, draws the fit and residuals, and writes graph artifacts. The SciPy program also reads `analysis.json`; the generated ROOT program retains its model and fit setup in C++ while taking observations from CSV. Custom expressions are emitted from the validated syntax tree, with real-valued numeric literals in C++. Alternate Python metadata must match the generated equation, parameter order and equation-defining options. Data Tool does not run or bundle either external environment, and the generated comments disclose possible solver/version/local-minimum differences. ROOT uses Minuit2 through `ROOT::Fit::Fitter`, physical parameter coordinates, and one-sided positive limits. It requires successful status, full covariance quality for free parameters, and finite results before writing successful fit artifacts. Its unknown-equal path explicitly estimates residual scatter and refits with a uniform error to align covariance conventions. If scatter cannot be estimated, standard errors remain unavailable and its provisional minimizer covariance is saved separately with an explanatory title. Browser and native builds create the archive locally; native saving is bounded and atomic. See [the detailed workflow and formulas](model-comparison-and-code-export.md).

## 7. Multiple fits and intervals

The **Analysis** selector also offers model-comparison, collision and multi-interval workspaces. They use the same scientific core but remain in-memory analyses. Their existence must not be confused with saved multi-analysis sessions.

### 7.1 Model comparison

The comparison workspace stages exactly two candidates in its current interface, while the core accepts a candidate list. Either candidate can use the current analysis, choose a built-in model, or load a validated session. Both are refitted; loaded results are never trusted as cached fit output because sessions retain requests/settings rather than solver results. Failed loads preserve the existing candidate and the main analysis. Each candidate identifies its source and provides **Use current analysis** for an explicit refresh. The top Copy report, Print, and SVG/PNG/PDF export actions operate on the completed comparison. Printing uses measured pages with a transposed statistics table and optional rotated graph page; graph exports support physical sizing. Supplied ±1σ Y error bars appear on included data observations under the shared visibility preference. The paired graphs use equal inner widths, a shared X scale and bottom label, a compact gap, and a 3:1 data-to-residual height ratio. Residual ranges follow the actual values without an absolute unit-dependent floor.

Formal criteria require identical ordered included observations, exclusions, numerical uncertainties, X/Y assignments and units, error structure, assumption declarations, and conditional-inference acceptance. A mismatch blocks calculation with reasons. Supported or accepted-conditional independent Gaussian fits report normalized log likelihood, AIC and BIC with the correct likelihood parameter count. Comparison statistics also include residual degrees of freedom and χ²/df, matching the single-fit calculation. Reduced chi-squared is unavailable for unknown absolute noise scale or nonpositive residual degrees of freedom. Known supplied sigmas use AIC for ranking and mark the unknown-variance AICc correction inapplicable. Unknown equal scatter also reports AICc and uses it for ranking; it is unavailable for `n <= K+1` and approximate for nonlinear models. Delta and Akaike weights use the selected criterion and require at least two eligible candidates. Descriptive-only fits withhold formal criteria. Zero unknown residual variance and non-finite arithmetic are not converted into infinite evidence. The interface describes relative support among only the supplied candidates and does not announce a true or winning model.

### 7.2 Multi-interval fits

Select one X and one to four Y columns, then define up to five named intervals. Ranges start empty. A user selects an interval, drags a graph range, adjusts boundary handles or exact limits, selects an equation, edits per-curve starting/fixed values, and explicitly fits that interval. Boundary handles support keyboard arrows. Each interval shares its equation across curves but fits each curve independently. All single-curve equations, including custom equations, are available.

Built-in nonlinear starting estimates use each series' included observations within its selected interval, in the selected X units. Selecting a model before defining a range defers useful estimates until observations are available. Untouched estimates follow range or column changes; manually edited starting values or fixed flags are preserved for that series until explicit model reselection. These estimates do not trigger optimization or guarantee convergence.

Reducing the interval count hides extra intervals without discarding their setup or results; restoring the count restores them. Pending custom equations survive switching intervals. A valid interval can be fitted while another has an unfinished range.

Intervals include endpoints and may overlap. Missing observations are handled per curve. The graph shows the full data, intervals, and valid fitted segments, with residuals on shared X. Axes in this draft are linear. Changing one interval's scientific settings invalidates that interval; column or uncertainty changes invalidate all affected results. Changing X also clears ranges. Superseded worker work cannot reappear.

This mode offers residual-estimated scatter or one positive common sigma per curve. It does not inherit single-fit row exclusions or per-row uncertainties. Relevant known-false source assumptions still block inference. There are no linked parameters, enforced continuity, automatic event detection, derived charge/force/impulse quantities, or cross-fit covariance, including where intervals reuse the same observations.

Copy output places full interval/curve report blocks side by side for spreadsheets. Printing offers overview graphs/results and an optional residual/diagnostic appendix. Source notes remain available. See [multi-interval.md](multi-interval.md) for scope and tests.

### 7.3 Collision fits

Assign time and four position columns (two components for each of two objects), then choose disjoint inclusive before/after intervals. Initial outer-span suggestions are not event detection. Four position graphs share time and boundary changes; the user can drag, use keyboard controls, or enter limits. Explicit fitting runs eight independent line fits and reports slopes, units, available standard errors, residuals, rank, and inference diagnostics. A failure in one channel does not erase successful channels.

Per-column unknown scatter or supplied common sigma is supported; single-fit per-row uncertainty/exclusion inheritance is not. No momentum, energy, conservation conclusion, interval-selection uncertainty, or between-fit covariance is calculated. Copy produces a full tabular report. Printing offers an overview and optional component details. See [collision-draft.md](collision-draft.md).

### 7.4 Draft persistence boundary

Switching analyses preserves collision/interval setups and results while the source table is unchanged; editing/replacing source observations resets that dependent work. Comparison candidates and results persist across navigation and main-source changes as independent staged snapshots. Each candidate changes only through its own controls, including **Use current analysis**. Closing the window discards these unsaved workspaces. **Save session is disabled for multi-fit workspaces** and explains that their setup is not saved. Users can copy available results, print collision/interval results, and switch to a single fit to save the source table. Unsaved draft work activates close/replacement protection, and saving only the source does not clear it. Applying edited data asks before discarding interval work. A rebuild MUST NOT quietly insert this state into v1/v2/v3 files, claim that a downloaded session saved these setups, or interpret independent fits as a joint fit.

Single-fit and model-comparison reports use measured paper previews. Collision and multi-interval workspaces retain separate print layouts and native pagination that require their own validation.

## 8. File compatibility and application boundaries

### 8.1 Versioned interchange

Keep the established `tracker-fit-*` format names even though the program is independently branded. Validate both structure and semantics before importing or saving. Unknown versions/engines, duplicate row/exclusion identities, invalid uncertainty associations, inconsistent source tables, and incompatible settings are errors, not best-effort conversions.

| File                                           | Current version / engine                                                       | Compatibility rule                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `tracker-fit-request`                          | v1                                                                             | Immutable numerical request; remains v1 inside all current sessions.                          |
| `tracker-fit-ack`                              | v1                                                                             | Accepted/error envelope correlated by request UUID.                                           |
| `tracker-fit-session` for legacy built-ins     | v1; current writer `qr-vp-sine-2`, compatible older `qr-mgs2-1` reader support | Published v1 model set and engine constraints remain intact.                                  |
| Session for the five newer nonlinear built-ins | v2; `qr-lm-3`                                                                  | Explicit documented nonlinear migration.                                                      |
| Session for custom expressions                 | v3; `qr-expression-4`                                                          | Includes exact expression, independent variable, ordered names/units, values and fixed flags. |

All three session versions use `.trksess`. Current readers accept them; older readers must reject unknown versions rather than approximate or discard unsupported equations. Choosing a legacy built-in permits saving in its applicable older version. Original requests and acknowledgments stay v1. Full schemas and migration detail are in [integration.md](integration.md).

### 8.2 Tracker import and process integration

Saved Tracker point-mass positions can be read from `.trk` and bounded `.trz` archives. Apply the saved origin, angle, X/Y scale, image-Y convention, and supported calibration keyframes. Retain frame number, calibrated coordinates, original image-coordinate text, missing steps, and provenance. Do not decode media, fabricate missing positions, resolve external XML resources, or write extracted project files.

Frame number is initially independent. When saved mean frame interval/start time are available, the user may explicitly accept uniform timing to create seconds. This is a declared approximation, not reconstruction of variable-rate timestamps. Unsupported tracks, moving reference frames, and derived quantities require an appropriate Tracker data export. Malformed calibration and ambiguous numerical content fail safely. Current archives are limited to 100 MB, 100 embedded tabs, and 20 MB total extracted XML. See [tracker-import.md](tracker-import.md).

The native file/process boundary accepts `--open` and optional `--ack`, as documented in [integration.md](integration.md). `accepted` means full validation passed and data was staged for user review; it does not mean the user applied it or completed a fit. Source input files are never overwritten. Acknowledgments and native exports use temporary files and atomic replacement. One launch accepts one input; independent processes/windows must not share mutable analysis state. The browser cannot receive native process-launch acknowledgments. Automatic return of fitted parameters to Tracker is not implemented.

## 9. Errors, accessibility, and operational requirements

Specific errors should identify the invalid field, row, domain, assumption, or numerical condition and offer a comprehensible next action where possible. Technical diagnostics may be disclosed on demand, but neither a vague failure nor a reassuring success message may hide rank loss or unsupported inference. Failed imports, fit cancellation, clipboard denial, export conversion failure, and cancelled dialogs preserve work.

Undo/redo must preserve exact values, inclusion, and analysis settings across supported edits; data-dialog history and applied-analysis history are distinct. Current draft modes have incomplete history support, so a rebuild must not falsely advertise universal undo before implementing it. Native closing and replacement workflows respect unsaved analysis work; browser lifecycle protection cannot substitute for explicit session saving.

The current UI uses semantic buttons, labels, dialogs, disclosure controls, SVG accessible labels, and keyboard operations for table/plot actions. A rebuild MUST keep keyboard access, visible focus, readable errors, meaningful disabled states, and accessible names. It should verify that menus remain within the viewport, long titles/units remain legible, and enlarged interface sizes do not make actions unreachable. Graph and table information must not depend exclusively on color or pointer hover. These requirements do not claim a completed external accessibility audit.

Security boundaries include bounded parsing, restricted custom-expression evaluation, no external Tracker resource fetching, strict validated session data, safe clipboard table escaping, and isolated native file operations. Do not add production test hooks or environment-controlled hidden sample loading. Independent reference solvers, random generators, and test fixtures remain test tools rather than application services.

## 10. Acceptance and regression evidence

A rebuild should first freeze representative sessions, numerical fixtures, and observable workflows, then replace architecture behind those contracts. The baseline evidence lives in [core tests](../tests/fit/), [browser tests](../e2e/), native verification, and the independent numerical-reference generators. A test passing in one regime does not establish global convergence, universal statistical coverage, or every browser/printer's behavior.

| Acceptance scenario                                                                                | Required outcome / primary evidence                                                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Empty startup, load/cancel, malformed session, unsaved replacement                                 | No implicit data/fit; invalid/cancelled import leaves exact current work intact. `startup.spec.ts`, `fit.spec.ts`, schema tests.                                                                                 |
| Spreadsheet table with headers, units, extra columns, missing cells, high-precision values         | Correct explicit assignments, complete source table, stable identities, edit/undo/redo and session/CSV round trips.                                                                                              |
| `m` versus `mH`, unknown units, custom units                                                       | Case preserved without implicit conversion; labels agree across graphs, reports, saves, and exports.                                                                                                             |
| Weighted/unweighted, fixed/all-fixed, rank-deficient and zero-df fits                              | Coefficients, covariance, diagnostics and availability reasons match independent references and stated assumptions.                                                                                              |
| Built-in nonlinear and custom equations                                                            | Analytic/automatic derivatives, domain failures, local rank, convergence limits and known reference solutions tested; no stale worker overwrite.                                                                 |
| False/unknown/accepted assumptions; supplied uncertainty error                                     | Conditional/descriptive distinction retained; no silent fallback or fabricated inference.                                                                                                                        |
| Region selection, log display, axis Auto/custom ranges                                             | Exact inclusion unchanged by view; shared X preserved; hidden data and clipped errors disclosed. `graph-modes.spec.ts`, `auto-axes.spec.ts`.                                                                     |
| All marker shapes at enlarged display scale                                                        | Same exact observation is picked; no white halo; appearance propagates without changing saved scientific inputs. `display-options.spec.ts`.                                                                      |
| Residual visibility across all analyses, print and export                                          | Hidden residual graphs give their space to data graphs; X axes and unchanged fit/session inputs are preserved. `residual-visibility.spec.ts`.                                                                    |
| Standard/full-page print, data-only and fitted, long title/notes, five-parameter published dataset | Inner frame widths equal, short residual and tight gap, only lower shared X, complete readable paper pages. `print-layout.spec.ts`, `source-notes.spec.ts`.                                                      |
| SVG/PNG/PDF export with scientific labels, band and exclusions                                     | Matching geometry/styles, valid unique clips, readable glyphs, actual PNG pixels, vector cropped PDF with embedded font. `graph-export.spec.ts`.                                                                 |
| Physical figure sizes, editable presets, and 300/600 dpi raster resolution                         | Exact SVG millimetres/PDF page size/PNG pixel and resolution metadata; fixed label/marker sizes; unchanged fit/session inputs; hidden residuals honored in every mode. `export-sizing.spec.ts`.                  |
| Optional damped guides and derived oscillation quantities                                          | Default-off baseline/envelope propagate to screen/print/figure/code; amplitude/phase/frequency and full-covariance uncertainty remain model-consistent. `guides-code-export.spec.ts`, derived tests.             |
| Guarded model comparison                                                                           | Both candidates refit; incompatible samples/likelihoods block; normalized log likelihood and parameter-counted AIC/AICc/weights/BIC match reference formulas. `model-comparison.spec.ts`, core comparison tests. |
| CSV-backed SciPy/ROOT analysis bundle                                                              | ZIP layout, round-trippable CSV/masks/missing values, JSON metadata, alternate-input CLI, custom AST translation and unknown-scatter conventions are tested. `guides-code-export.spec.ts`, `codeExport.test.ts`. |
| Switching among single/multi-interval/collision modes                                              | Correct active graphs/report, unaffected results retained, affected work invalidated, unsupported draft saving explicitly disabled.                                                                              |
| Legacy/v2/v3 sessions and native acknowledgment                                                    | Validated compatibility and correct request correlation; accepted means staged review. Schema, workflow, and integration tests.                                                                                  |

Required repository checks are `npm test`, `npm run build`, and `npm run test:e2e`. Native host changes additionally require `npm run test:desktop`; protocol/launcher work should exercise `npm run test:integration`. Hosted changes should exercise the actual base-path build and `npm run test:web`. Keep reference generation reproducible and separate from the runtime. Release checks must validate the final source state, not an earlier partially implemented layout.

**Print/export verification MUST include rendered artifacts.** Inspect actual PDF pages as images, confirm paper dimensions and page count, check complete source text and axis glyphs, and compare the data/residual frame edges. Verify print and preview together. In particular, equal outer SVG widths with different CSS heights can yield unequal inner widths through aspect-ratio letterboxing; that was a concrete regression in this application. Browser PDF checks are useful evidence but do not certify macOS printer behavior.

## 11. Proposed next-generation improvements

The following are design directions beyond the current baseline above. They should improve maintainability and usability without changing scientific meaning by accident.

1. **Separate the analysis model from its screens.** Use explicit immutable commands/revisions for source-table edits, scientific settings, worker requests/results, and undo. Give draft analyses a documented state machine. Reduce the responsibilities of `FitApp.tsx` without moving DOM or file access into the core.
2. **One figure geometry model.** Define data/residual frames, shared scales, labels, bands, markers and gaps in a renderer-independent scene. Reuse it across screen, paginated print, SVG, PNG and vector PDF. Shared frame geometry should make width/spacing regressions structurally difficult, while allowing appropriate typography and dimensions for each medium.
3. **One report model, several outputs.** Build typed semantic sections for parameters, statistics, correlations, observations, warnings and source notes, then render copy, print and accessible on-screen views from them. Retain precision/availability semantics; improve consistent labeling before adding report templates.
4. **Common contextual controls.** Consolidate popover dismissal/focus/positioning and shared axis/appearance primitives. Make the primary Data/save/output workflow obvious and keep advanced scientific controls near their consequences. Prefer a few understandable choices over a setting for every imagined use case.
5. **Explicit persistence for multi-analysis work.** Design and document a new versioned format before saving collision/interval setups, presentation preferences or multiple analyses. Specify migration, partial failure, original-source identity, and the distinction between independent and joint fits. Never retrofit fields into old strict schemas.
6. **Localization with scientific review.** First replace English-label dependencies in CSS, graph-export queries, table-focus navigation, and error-message parsing with stable internal identifiers and structured error codes. Extract interface/help/report text into translation catalogs; use locale-aware pluralization and accessible labels. Pilot one additional language, with a bilingual scientist or teacher reviewing technical terms such as uncertainty, standard error and confidence interval. AI drafts may accelerate translation but are not verification. Preserve formulas, parameter identifiers, case-sensitive unit symbols and machine-readable file formats. Design display-number localization separately from CSV/import and canonical numeric serialization so a comma decimal separator cannot silently change data. No translations or localization framework are currently shipped.
7. **Broader layout and accessibility validation.** Add representative narrow screens, enlarged text, keyboard-only use, longer translated labels, screen-reader checks, A4 design if desired, and real native printer checks. Document support rather than assuming a browser preview proves every target works.
8. **Extend publication styling at export.** Build on the implemented physical dimensions, point-size labels, editable presets, and raster resolution described in section 6.3. Possible additions are final line-width and font-family controls under **Export**. Keep print-page layout in Print and avoid spreading per-journal settings throughout the app. SVG supports further editing, and EPS may be needed for particular production workflows. Optional PGFPlots/TikZ output could support document-controlled typography, but requires a separate validated renderer and is not inherently higher-quality than vector PDF. Additional output formats and styling controls must preserve the current scientific and geometry guarantees.

Possible future methods—general parameter bounds, robust regression, X-error fitting, correlated-error solvers, linked parameters, full uncertainty budgets, comparison of dependent/correlated fits, or specialized nested-model tests—are separate scientific projects. Each needs explicit equations, supported assumptions, failure semantics, independent references, and migration decisions. A rebuilt interface must not imply these methods exist merely because it can display their names.

## 12. Implementation map for the rebuild

| Current location                                                     | Responsibility to preserve                                                                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/core/fit/`                                                      | Strict schemas, tables, selections, expressions, numerical solvers, uncertainty, interval/collision calculations, semantic reports. |
| `src/import/`                                                        | Bounded local Tracker XML/archive interpretation and provenance.                                                                    |
| `src/fit/FitApp.tsx`                                                 | Main analysis lifecycle, controls, graph rendering and single-fit report assembly; a candidate for decomposition.                   |
| `src/fit/*worker.ts`                                                 | Fit jobs outside the interaction thread and protection against obsolete work.                                                       |
| `src/fit/ImportPanel.tsx`                                            | Staged source-table review/editing and table history.                                                                               |
| `src/fit/DisplayMenu.tsx`, `PlotAppearance.tsx`, `YAxisControls.tsx` | Shared appearance and contextual axis controls; the axis file also supplies X controls.                                             |
| `src/fit/PrintPages.tsx`, `SourceNotes.tsx`, `graphExport.ts`        | Measured paper pagination, complete source appendices and vector/raster figure conversion.                                          |
| `src/fit/ExportSizeDialog.tsx`, `exportSizing.ts`, `plotScale.ts`    | Physical figure dimensions, label size and raster resolution; shared automatic/manual axis geometry.                                |
| `src/fit/MultiInterval.tsx`, `CollisionDraft.tsx`                    | Separate draft workflows and their limits.                                                                                          |
| `src-tauri/`, `bin/`, `scripts/`                                     | Small native host, launch/file boundary, packaging and verification.                                                                |
| `schemas/`, `examples/data/`, `tests/`, `e2e/`                       | Interoperability contracts, ordinary reproducible/example files, independent scientific and interaction evidence.                   |

The next implementation is successful when a user can confidently move from exact local observations to a scientifically qualified result and a usable paper figure with fewer surprises—and an independent maintainer can verify why the result, file, and figure are correct.

The [September 2026 usability audit](usability-audit-2026-09-12.md) records reproducible findings, local corrections, verification, and remaining design decisions, including the distinction between saved fit provenance and later source-note edits in draft workspaces.
