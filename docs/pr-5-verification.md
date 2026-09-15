# PR #5 verification and corrections

Historical release record. Current development builds support only session v7; see the [pre-beta migration](integration.md).

Verified on macOS arm64, 2026-09-14. These checks cover the shared model-comparison
workspace, equation families, Gaussian peak shapes, fit guides, number display, and SciPy/ROOT analysis
exports. They do not establish universal solver agreement or native printer
behavior.

## Scientific and export behavior

- Known supplied Gaussian standard deviations retain their absolute scale and
  use AIC for ranking. The estimated-variance AICc correction applies only to the
  unknown-scatter path. A six-point line-versus-quadratic regression checks a case
  where the incorrect correction reversed the preferred model. Delta labels and
  weights follow the selected criterion. Extreme finite sigmas use stable log
  normalizers; unavailable criteria cannot appear as available evidence.
- Sine-family amplitude and phase uncertainties use the complete covariance.
  Phase availability is invariant to a change of Y units; phase at zero amplitude
  is explicitly unavailable. The new chooser has one Sinusoid entry, with Fix T
  for a supplied period. Saved fixed-period sine sessions remain editable.
- Polynomial degrees 2–10 use column-scaled, pivoted QR with rank diagnostics.
  Added growth and sigmoid models use analytic Jacobians and positive time/width
  parameters. Independent SciPy fixtures use complex-step derivatives and SVD
  covariance. High-degree polynomials and nonlinear fits retain their numerical
  and extrapolation limitations.
- Additional families use session v4; adjustable Gaussian peaks use session v5.
  Earlier published schemas are unchanged; requests and acknowledgments remain
  v1. Native envelope validation accepts both versions.
- Optional Gaussian skew/tail parameters use a mode-centered sinh–arcsinh normal
  peak. Analytic sensitivities include its moving mode and height normalization.
  Independent SciPy fits, SVD covariance and adaptive moment integration verify
  skew-only, tail-only and joint cases. Derived moments use full covariance
  propagation, with explicit unavailable results when integration or first-order
  uncertainty is unresolved. See [peak shapes](peak-shapes.md).
- The Lorentzian CSV includes its original generating uncertainties, ranging
  from 0.020 to 0.03975 V. All X/Y tokens are unchanged. An import regression
  reproduces the independently weighted Lorentzian chi-squared/df of 0.8029819.
- Separate SciPy and ROOT ZIPs preserve source comments in the CSV preamble,
  exact observations, exclusions, units, uncertainty assumptions, and metadata.
  Python includes requirements.txt. Programs put the model function first and
  separate loading, fitting, reporting, plotting, and main. ROOT opens an
  interactive canvas by default; its documented batch invocation remains usable.
- ROOT uses physical parameter coordinates and one-sided positive bounds through
  ROOT::Fit::Fitter. Failed convergence, bad covariance, and non-finite outputs
  fail explicitly. Zero residual scatter does not substitute unit-error standard
  errors. Python uses analytic polynomial Jacobians for the added high degrees.
- Generated readers preserve the CSV inclusion/missing-value contract, quoted
  multiline cells, leading comments, UTF-8 BOM, and finite subnormal values.
  Invalid metadata and numeric inputs are rejected.

## Workspace and presentation behavior

The comparison opens with the current observations and supports two to six
models. Shared uncertainty and point-selection controls apply to every candidate;
the selected candidate exposes its equation, starting values, fixed parameters,
and diagnostics. Custom equations can be carried from the main analysis or
loaded from validated sessions. Main-source changes refresh shared data while
retaining candidate models. Selection supports the main-window click/drag
modifiers and undo.

Unsaved-data replacement now uses a visible modal confirmation. It previously
appeared below the comparison workspace, making loading seem unresponsive.
Browser checks verify cancel preserves the fitted comparison and acceptance
refreshes every candidate while preserving equations and clearing stale results.

Comparison outputs include the full report, print and sized SVG/PNG/PDF figures,
individual candidate sessions, and SciPy/ROOT programs for every candidate.
Candidate labels and workspace display preferences are not session fields.
The paired data/residual frames share their X scale and inner width, with a 3:1
inner-height ratio. Measurement error bars remain a separate display preference
from the uncertainties used for fitting.

Single, multi-interval, and comparison figures share the fit-guide toggle. Guides include
damped envelopes and baseline, sinusoid baseline, Gaussian/Lorentzian center,
and sigmoid midpoint and asymptotes. Labels occupy rows above the plot frame;
they no longer compete with fitted curves. Explicit ranges clip guides normally.
Print, vector/raster figures, and executable exports retain enabled guides,
including each comparison candidate's own fitted center or baseline.
Export validation rejects figures too small to contain their guide labels.

Result displays use scientific notation below 0.0001 and from 10^7, without
rounding stored values. The X-ray quadratic example displays its small c2 and
extremely small Q compactly. Editable controls preserve exact values and
unfinished input. Toolbar buttons have consistent heights across UI scales.

## Validation

- `npm test`: 248 tests in 32 files passed.
- `npm run build` and `npm run build:web`: passed.
- `npm run test:e2e`: all 161 browser tests passed on an isolated local server.
- `npm run test:web`: all 3 packaged-web tests passed.
- `npm run test:desktop`: all 5 native tests passed.
- `npm run test:code-exports`: all 25 executable cases passed with SciPy 1.18.1
  and actual ROOT 6.40.04. Checks require successful ROOT status, compare every
  fitted coefficient, and verify output artifacts. Cases cover the added model
  families, peak shapes and moments, fixed parameters, guides, comments, quoted labels, zero scatter, and
  rejected metadata/CSV inputs.
- Browser checks cover shared comparison controls and selection, custom/session
  round trips, candidate archives, equation menus, number formatting, guide
  placement and clipping, unchanged parameters when guides toggle, print layouts,
  and sized SVG/PNG/PDF outputs. Rendered guide and report figures were also
  inspected visually.
- TypeScript, scoped formatting, and `git diff --check`: passed.

The checks use local tools. Data Tool itself does not install or execute SciPy
or ROOT, introduce a network service, or compute Bayesian evidence. The native
tests do not constitute a rebuilt or launched Mac application, and physical
printer drivers were not tested. See [the methods and workflow](model-comparison-and-code-export.md)
and [equation families](equation-families.md) for conventions and limitations.
