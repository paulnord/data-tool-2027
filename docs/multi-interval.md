# Multi-interval fit draft

Choose **Analysis → Multi-interval fit…**. The existing collision option and single-fit tools remain available.

Select one to four Y columns against one X column. Choose up to five intervals. Ranges start empty: select an interval tab, drag across a data graph to mark its range, then adjust its draggable boundary lines or the exact From/To fields. Keyboard arrows move a focused boundary by one percent of the displayed X span. Names are editable. Ranges use inclusive endpoints and may overlap. Shared observations can correlate fitted results; cross-fit covariance is not calculated. There is no automatic event detection or fit on import, range selection or equation changes.

Choose an equation for each interval, then press **Fit [interval name]** directly below the interval-selection buttons. The uncertainty-assumptions control remains directly beneath Fit. All existing single-curve equations, including custom equations, are available. The equation is shared across curves within that interval, while each curve has its own starting/fixed parameter values. Use **Parameters for** to edit the chosen curve's parameters. Supplied period, period search limits, or supplied rate/exponent are common within an interval. Custom expressions use the same restricted parser as single fits. There are no linked parameters or enforced continuity between intervals.

Built-in nonlinear models suggest starting values separately from each series' observations inside the selected range. Choosing the model before selecting a range defers the suggestion until observations are available. Untouched suggestions follow range or column changes; editing any starting value or fixed flag preserves that series' settings until the model is explicitly selected again. Suggestions do not run a fit or guarantee convergence. For damped oscillations, period and decay time use the selected X column's units: Frame gives frames, while Time (s) gives seconds.

Results remain beside the graph for comparison. A boundary, equation or parameter change clears that interval's result and cancels pending work; other intervals retain their results. Changing columns, curve count, uncertainty mode/values or acceptance of assumptions clears all results. Changing X also clears the selected ranges. The complete source observations are preserved, and missing data are handled separately by curve. Single-fit row exclusions and supplied per-row uncertainties are not inherited; choose residual-estimated scatter or explicitly enter a common Y sigma for each curve. Known-false exact-X or independent-error declarations and known correlation for the same source columns still block inference.

The graph displays all observations, gaps, colored intervals and fitted curves only where fits exist. Residuals use the same X axis. Graphs here use linear axes. Derived quantities such as momentum, impulse, force or charge are outside the current fitting scope. Reports can be exported for further calculation in a spreadsheet or another analysis tool.

Each fitted curve extends up to 10% of its fitted observation span at either end, clipped to the current view. The extensions are thinner, fainter dashed lines; interval-specific patterns also distinguish them in monochrome. They are model extrapolations, not additional observations or residuals. Enable **Settings → Show fit guides when available** to draw the dotted fitted offset **b** and dashed upper and lower amplitude envelopes for every damped oscillation. A color-keyed legend above the plot identifies b for each interval, keeping labels clear of observations and curves. The same setting controls guides in the single-fit view. This is the model's mean position, not the arithmetic average of the observations. Automatic Y limits include the fitted curve and enabled guides, but omit extrapolated tails so a growing tail cannot compress the data. These guides also appear in printing and graph exports.

**Copy report** arranges full reports side by side with one blank spreadsheet column between each interval/data-series block. It includes each interval's range and full per-curve fit report, including parameters, units, uncertainties, diagnostics and residual observations. Unfitted intervals and failed curves are explicitly identified. **Print** provides an overview with the selected ranges, plots and fitted parameter values. **Include residuals and diagnostics when printing** adds a section starting on a new page for each interval, keeping individual curve results together. Long/many-parameter reports may need additional pages. Print ancestors use ordinary block flow, with legacy and modern page-break properties, following the Mac collision-print fix. Browser PDF checks do not substitute for checking the Mac printer preview.

## Ordinary example files

- `examples/data/cart-track.csv`: two one-dimensional carts, before/after motion.
- `examples/data/bounce-intervals.csv`: approach, a sinusoidal spring-like contact interval, and departure; gravity omitted over this short synthetic event.
- `examples/data/oil-drop-intervals.csv`: three constant-drift segments for one drop. This illustrates fitting intervals, not extracting a charge measurement.

All are explicitly labeled synthetic with independent Gaussian scatter and a reproducible seed. They are generated by `tests/support/generate-interval-examples.py` and bundled as normal files in Examples, without application example menus.

## Persistence and compatibility

**Save session** preserves the active multi-interval workspace in a v6 `.trksess`
file: complete source table, assignments, uncertainty settings, interval names
and ranges, equations, per-series starting/fixed parameters and custom units,
active controls, plot limits and guide/residual visibility. Hidden interval slots
are retained when the displayed interval count is reduced. Reopen through
**Data… → Load file**, accept the data review, then fit each interval explicitly.
Results and undo history are recalculated rather than stored. Incomplete numeric
entries and unapplied equations must be resolved before saving. Other hidden
workspaces are not part of this file; their unsaved-work protection remains active.

The [v6 migration](integration.md#session-v6-for-saved-workspaces--2026-09-15)
leaves request/ack v1 and all single-fit session versions unchanged. Import/save
validation checks row associations, columns, settings and ranges. Core and browser
tests cover persistence, invalid imports and reproduction of both Cavendish fits.

The measured example `examples/data/cavendish/cavendish-multi-interval.trksess`
restores two damped fits over 0–1400 s and 1800–4500 s. Its companion CSV preserves
all original fields and missing observations; the folder README describes the
provenance and uncertainty limitations.

The same guide setting marks Gaussian/Lorentzian centers, the mean position of either undamped sine model, and the logistic sigmoid midpoint and two asymptotes. These model references use the same keyed legend above the plot. Explicit view limits clip the guides without changing fits.
