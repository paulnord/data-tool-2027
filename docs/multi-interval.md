# Multi-interval fit draft

Choose **Analysis tools → Multi-interval fit**. Collision and Single fit remain available in the same selector.

Select one Y column against one X column, then choose up to five intervals. Ranges start empty: select an interval tab, drag across the data graph to mark its range, then adjust its draggable boundary lines or the exact From/To fields. Keyboard arrows move a focused boundary by one percent of the displayed X span. Names are editable. Ranges use inclusive endpoints and may overlap. Shared observations can correlate fitted results; cross-fit covariance is not calculated. There is no automatic event detection or fit on import, range selection or equation changes.

Choose an equation for each interval, then press **Fit [interval name]** directly below the interval-selection buttons. The uncertainty-assumptions control remains directly beneath Fit. All existing single-curve equations, including custom equations, are available. Each interval has its own starting/fixed parameter values. Custom expressions use the same restricted parser as single fits. There are no linked parameters or enforced continuity between intervals.

Built-in nonlinear models suggest starting values from the selected Y observations inside the selected range. Choosing the model before selecting a range defers the suggestion until observations are available. Untouched suggestions follow range or column changes; editing any starting value or fixed flag preserves the interval's settings until the model is explicitly selected again. Suggestions do not run a fit or guarantee convergence. For damped oscillations, period and decay time use the selected X column's units: Frame gives frames, while Time (s) gives seconds.

Results remain beside the graph for comparison. A boundary, equation or parameter change clears that interval's result and cancels pending work; other intervals retain their results. Changing X or Y, the uncertainty mode/value, or acceptance of assumptions clears all results. Changing X also clears the selected ranges. The complete source observations are preserved, including unused columns and missing values. Single-fit row exclusions and supplied per-row uncertainties are not inherited; choose residual-estimated scatter or explicitly enter one common Y sigma. Known-false exact-X or independent-error declarations and known correlation for the selected source columns still block inference.

The graph displays all observations, gaps, colored intervals and fitted curves only where fits exist. Residuals use the same X axis. Graphs here use linear axes. Derived quantities such as momentum, impulse, force or charge are outside the current fitting scope. Reports can be exported for further calculation in a spreadsheet or another analysis tool.

Each fitted curve extends up to 10% of its fitted observation span at either end, clipped to the current view. The extensions are thinner, fainter dashed lines; interval-specific patterns also distinguish them in monochrome. They are model extrapolations, not additional observations or residuals. Enable **Settings → Show fit guides when available** to draw the dotted fitted offset **b** and dashed upper and lower amplitude envelopes for every damped oscillation. A color-keyed legend above the plot identifies b for each interval, keeping labels clear of observations and curves. The same setting controls guides in the single-fit view. This is the model's mean position, not the arithmetic average of the observations. Automatic Y limits include the fitted curve and enabled guides, but omit extrapolated tails so a growing tail cannot compress the data. These guides also appear in printing and graph exports.

**Copy report** arranges full interval reports side by side with one blank spreadsheet column between them. It includes each interval's range and complete fit report, including parameters, units, uncertainties, diagnostics and residual observations. Unfitted intervals and failed fits are explicitly identified. **Print** provides an overview with the selected ranges, plot and fitted parameter values. **Include residuals and diagnostics when printing** adds a section starting on a new page for each interval. Long/many-parameter reports may need additional pages. Print ancestors use ordinary block flow, with legacy and modern page-break properties, following the Mac collision-print fix. Browser PDF checks do not substitute for checking the Mac printer preview.

## Ordinary example files

- `examples/data/cart-track.csv`: two one-dimensional carts, before/after motion.
- `examples/data/bounce-intervals.csv`: approach, a sinusoidal spring-like contact interval, and departure; gravity omitted over this short synthetic event.
- `examples/data/oil-drop-intervals.csv`: three constant-drift segments for one drop. This illustrates fitting intervals, not extracting a charge measurement.

All are explicitly labeled synthetic with independent Gaussian scatter and a reproducible seed. They are generated by `tests/support/generate-interval-examples.py` and bundled as normal files in Examples, without application example menus.

## Persistence and compatibility

**Save session** preserves the active multi-interval workspace in a v7 `.trksess`
file: complete source table, assignments, uncertainty settings, interval names
and ranges, equations, starting/fixed parameters and custom units,
active controls, plot limits and guide/residual visibility. Hidden interval slots
are retained when the displayed interval count is reduced. Reopen through
**Data… → Load file**, accept the data review, then fit each interval explicitly.
Results and undo history are recalculated rather than stored. Incomplete numeric
entries and unapplied equations must be resolved before saving. Other hidden
workspaces are not part of this file; their unsaved-work protection remains active.

Earlier v7 files may contain two to four Y series in one multi-interval
workspace. They remain valid compatibility inputs: Data Tool labels them as
legacy multi-series sessions, preserves their per-series controls, and writes
the same series back when saved. The series-count chooser is not offered, so a
new multi-interval analysis always starts with exactly one Y series.

The [current format](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15)
replaces session v1–v6 while leaving request/ack v1 unchanged. Import/save
validation checks row associations, columns, settings and ranges. Core and browser
tests cover persistence, invalid imports and reproduction of both Cavendish fits.

The measured example `examples/data/cavendish/cavendish-multi-interval.trksess`
restores two damped fits over 0–1400 s and 1800–4500 s. Its companion CSV preserves
all original fields and missing observations; the folder README describes the
provenance and uncertainty limitations.

The same guide setting marks Gaussian/Lorentzian centers, the mean position of either undamped sine model, and the logistic sigmoid midpoint and two asymptotes. These model references use the same keyed legend above the plot. Explicit view limits clip the guides without changing fits.
