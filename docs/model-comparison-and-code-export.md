# Model comparison, fit guides and code export

Model guides and source-code output are presentation/export choices. Model
comparison is an in-memory workspace that refits its candidates; it does not
cache fitted results in a `.trksess` file. These features introduce no additional
protocol fields. Added equation families use the documented [current session format](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15);
requests and acknowledgments remain v1.

## Model guides and oscillation quantities

**Settings → Graphs → Show fit guides when available** is off by default. For a damped
oscillation it adds muted dashed references for the fitted baseline

\[
y=b
\]

and amplitude envelope

\[
y=b\mathbin{\pm}\sqrt{s^2+c^2}\exp(-x/\tau).
\]

The fitted oscillating curve remains visually dominant. The guides use the
same axes in the display, print preview and SVG/PNG/PDF exports. They are not
additional observations, model terms or constraints and do not trigger a
refit. Single, multi-interval, and model-comparison plots also offer:

| Model                               | Guides                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------ |
| Gaussian and Lorentzian peaks       | Vertical center at x = μ; also valid for negative peaks                                    |
| Sine with supplied or fitted period | Horizontal mean position y = b                                                             |
| Logistic sigmoid                    | Vertical midpoint x = x₀, where y = b + A/2, and horizontal asymptotes y = b and y = b + A |

For a falling sigmoid, b + A is below b; the labels specify the parameter values rather than assuming an upper/lower ordering. Guide labels sit above the plotting frame, keyed by interval or comparison candidate. Explicit axis limits clip guides normally; vertical center markers do not expand the x range or change automatic y limits. The existing guide toggle controls all of these references. Comparison candidates retain their own guide colors and fitted reference values. The simple SciPy/ROOT scripts draw the selected observations and fitted curve; use the figure exports for this guide layout. Custom equations and other built-ins have no automatic reference guides.

Sine-family diagnostics report amplitude
\(A=\sqrt{s^2+c^2}\), phase \(\phi=\operatorname{atan2}(c,s)\) for
\(A\sin(2\pi x/T+\phi)\), and frequency \(f=1/T\). Their standard errors use
first-order propagation through the complete fitted covariance, including the
covariance between `s` and `c`. Phase is relative to the dataset's current X
origin and is explicitly unavailable when the amplitude is zero. Phase
availability does not depend on an absolute threshold in the chosen Y units.
Separate `s sin(...)` and `c cos(...)` curves are not drawn because that
decomposition also changes when the X origin changes.

## Comparing fitted models

Choose **Analysis tools → Model comparison** before or after fitting. The opened data
appear immediately above the observations table. Opening or editing the main
source data refreshes every comparison candidate while retaining the selected
models. Switching between Single fit and the comparison tool alone preserves
candidate settings and results.

Start with two candidates and use **Add model** for up to six. Select a candidate
tab to display its equation, parameter values, fixed flags, and model-specific
settings. Custom equations can be brought from **Use current analysis**, edited
directly, or loaded from a validated `.trksess` file. A failed session import
preserves the candidate. **Refit and compare** fits every candidate in this
workspace; a separate single fit is unnecessary.

**Y uncertainty model** selects shared equal weighting with estimated residual
scatter, supplied common σ, or available per-observation σ. The text above the
plot states which uncertainties are actually used. Error-bar visibility changes
only the drawing. Supplied uncertainties retain their absolute scale. Shared
assumption acceptance does not verify the assumptions.

Click points to toggle inclusion; drag to replace the selected region,
Shift-drag to add, and Option/Alt-drag to exclude. These gestures use the same
rectangle-selection rule as the single-fit view. Exclusions apply to all models;
source-excluded or missing rows remain unavailable. **Undo selection** restores
the preceding common selection. Differing source tables must be reconciled
before shared selection is enabled. Per-candidate diagnostics include parameter
standard errors, local 95% intervals, correlations, derived oscillation
quantities, and numerical rank diagnostics.

**Save session** writes one v7 `.trksess` containing every candidate's data,
settings, label and source metadata, the active candidate, and guide/residual/error-bar
visibility. Open it through **Data… → Load file** and accept the data review to
restore the complete comparison. Press **Refit and compare** to recalculate
results. Candidate file controls continue loading single-fit v7 sessions.
See the [workspace migration](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15).
The SciPy and ROOT exports include
separate candidate directories, each with its CSV, metadata, and executable
program, plus the comparison report. Python directories include requirements.txt.

The data and residual graphs share one horizontal scale, equal inner widths,
and one bottom X label. Their inner heights are in a 3:1 ratio, with a compact
shared gap. Residual scaling follows the actual values without an absolute
floor in the Y units. Hiding residuals gives their space to the data graph.

The table and copied report include **χ²/df (reduced chi-squared)** and the
residual degrees of freedom, `df = n − k`, using the single-fit diagnostic.
It is available with supplied absolute measurement uncertainties and positive
degrees of freedom. When scatter is estimated from the residuals, the statistic
is unavailable: using that estimated scale would force the ratio to one.

Supplied Y uncertainties appear as ±1σ bars on the included data observations.
**Show y error bars (±1σ)** shares its visibility preference with the single-fit
view. Residual-estimated scatter is not substituted for measurement error bars;
residual panels retain the app's data-only error-bar convention.

The top **Copy report**, **Print**, and **Export** actions follow the active
comparison. Print opens the measured paper preview, with a compact statistics
table and an optional rotated full-page graph. SVG, PNG, and PDF exports contain
all labeled candidate curves, shared-axis residuals when visible, and supplied
error bars. **Figure size…** applies the same physical dimensions, font size and
PNG resolution controls as the other graph exports. These output actions require
a current completed comparison. Candidate sessions can be saved before fitting
when their inputs are valid.

Formal comparison is blocked unless all candidates have exactly the same
ordered included X/Y observations, exclusions, numerical Y uncertainties,
axis assignments and units, error structure, fit assumptions, and conditional-
inference acceptance. Request/snapshot IDs and dataset titles need not match. This guard is
deliberately stricter than visually similar plots because likelihood criteria
do not compare different samples or error models.

For supplied independent Gaussian standard deviations, the log likelihood is

\[
\log L=-\frac12\left[\chi^2+\sum_i\log(2\pi\sigma_i^2)\right].
\]

Here \(K\) is the number of free model parameters. With unknown equal scatter,
the fitted maximum-likelihood variance is \(\hat\sigma^2=\mathrm{SSE}/n\),

\[
\log L=-\frac n2\left[\log(2\pi)+1+\log(\mathrm{SSE}/n)\right],
\]

and \(K\) also counts that estimated variance. The workspace reports

\[
\mathrm{AIC}=2K-2\log L,
\qquad
\mathrm{AICc}=\mathrm{AIC}+\frac{2K(K+1)}{n-K-1},
\qquad
\mathrm{BIC}=K\log n-2\log L.
\]

With supplied, known Gaussian standard deviations, ranking uses **AIC**;
the unknown-variance AICc correction above is not applicable. With unknown
equal scatter, ranking uses **AICc**, which is unavailable when \(n\le K+1\).
The displayed delta and Akaike weights use that same criterion and require at
least two eligible candidates. The AICc correction is exact for the usual
Gaussian linear-regression setting and an approximation for nonlinear models;
it is not a universal small-sample correction. See R. Maier,
["Information criteria for deciding between normal regression models"](https://arxiv.org/abs/1305.5493)
for the distinction between known and estimated variance.

Weights describe relative support only within that candidate set and are not
probabilities that a model is true. If assumptions make the underlying fits descriptive only,
formal likelihood criteria are unavailable rather than presented with false
precision.
Nonlinear convergence, local-minimum and conditioning warnings remain visible.

## SciPy/ROOT analysis bundle

After a fit, choose **Export → Python / SciPy analysis bundle (.zip)** or
**Export → C++ / ROOT analysis bundle (.zip)**. There is one simple export style.
Each candidate in a comparison receives its own program and data directory.

The equation comes first in the generated source. Small functions load data,
set up the model, call the library fit, report parameters, and plot the fit.
A main routine drives them. Starting values, fixed parameters, bounds and
uncertainty weighting are explicit in the code. Edit these directly to adapt
an analysis. Only models that need additional mathematics, such as the
sinh–arcsinh peak, include additional evaluation functions.

Each bundle contains:

- `data.csv`: only the selected finite observations, in original order, with
  numeric columns `x,y,sigma_y` for supplied uncertainties or `x,y` for equal weights;
- `observations.csv`: the complete original table, including row identities,
  inclusion flags, uncertainties and missing-value reasons;
- `analysis.json`: provenance, units, assumptions, original fit setup,
  selected row IDs, original coefficients, display settings and output filenames;
- `fit_scipy.py` and `requirements.txt` for SciPy, or `fit_root.C` for ROOT; and
- `README.md`: run instructions, CSV layout and statistical conventions.

Both CSVs preserve source comments in a leading `#` preamble. Numeric fit inputs
are round-trippable without rounding. Every numeric row in `data.csv` is fitted;
selection is already applied by the exporter. Missing and excluded observations
remain in `observations.csv`. The scripts do not read `analysis.json`; it records
the original analysis for reference.

### Python/SciPy

Run in the extracted directory:

```sh
python3 -m pip install -r requirements.txt
python3 fit_scipy.py
```

The script uses `numpy.loadtxt` and `scipy.optimize.curve_fit`, prints parameter
values and standard errors, opens a basic data/fit plot, and saves a PNG.
Importing it only defines functions. Change the filename in `main()` or call
`load_data("another-run.csv")` to reuse it with the same numeric layout.
Use `MPLBACKEND=Agg python3 fit_scipy.py` for a headless run.

Supplied uncertainties use `absolute_sigma=True`; unknown equal scatter uses
residual variance SSE/(n − free parameters). Fixed parameters are held at their
recorded values and omitted from optimization. Scalar custom equations broadcast
over data and plot coordinates. Polynomial exports include analytic derivatives;
update those derivatives if changing the polynomial equation.

### C++/ROOT

Run from the extracted directory:

```sh
root -l fit_root.C
```

The macro uses `TGraphErrors`, `TF1`, the standard graph `Fit` call, `TFitResult`,
and `TCanvas`. It opens the graph and saves a PDF. Quit ROOT with `.q` or use
`root -l -b -q fit_root.C` for batch output. Another compatible table can be passed
with `root -l 'fit_root.C("another-run.csv")'`.

ROOT fits supplied uncertainties directly. With no supplied uncertainties,
ROOT's graph fitter uses equal weights and scales its covariance by SSE/df.
Physical positivity restrictions use one-sided bounds. Failed optimization or
rank-deficient covariance stops the macro before saving a successful figure.
The library numeric CSV reader assumes the exported layout and can skip malformed
lines; check the reported df after editing the data.

### Scope and statistical interpretation

The simple plot shows selected observations, supplied error bars and the fitted
curve on linear axes. Use the application's report and SVG/PNG/PDF figure
exports for residual panels, fit guides, axis preferences and derived quantities.
Error-bar visibility in the app does not remove supplied uncertainties from
the code export's fit or plot.

Both programs report fixed parameters explicitly and withhold standard errors
when assumptions are unsupported or residual variance cannot be estimated.
Statistical interpretation remains conditional on the recorded assumptions.
SciPy's local Jacobian covariance and ROOT's objective-curvature covariance can
differ for nonlinear fits. Both are approximations; starts, optimizer stopping
rules, numerical conditioning and local minima can also affect agreement.
The application does not execute Python or ROOT.

The custom equation is translated from a validated syntax tree. Parameter names
that conflict with Python syntax receive safe aliases in the model function;
reports retain their original names. Measurements are never compiled into source.

### Export format change

Analysis bundle metadata is version **2** for these simple exports. Version 1
used a six-column `data.csv` and runtime metadata in Python; that complete table
now lives in `observations.csv`, while `data.csv` is a numeric fit input.
Existing downloaded bundles remain self-contained and runnable. This change
has no effect on the tracker request/ack or `.trksess` formats.

The detailed version-1 generator remains in
[`scripts/reference/fullCodeExport.ts`](../scripts/reference/fullCodeExport.ts)
for inspection and development validation. It is not an additional application
setting or export choice. See its [reference notes](../scripts/reference/README.md).

## Verification and references

`npm test`, `npm run build` and `npm run test:e2e` cover the application and
archive structure. `npm run test:code-exports` executes the generated programs
with SciPy/Matplotlib and ROOT when installed. It checks actual coefficients,
selected observations, χ² or SSE, degrees of freedom, fixed flags and unavailable
uncertainties across linear, nonlinear and custom equations, including polynomial
degrees 5–10 and skew/tail peaks. Dedicated linear cases check absolute supplied
uncertainties and residual-scaled covariance, including excluded observations.
Successful artifact creation alone is not evidence of a successful fit.

- [SciPy curve_fit](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.curve_fit.html): weighting and covariance conventions.
- [ROOT TGraphErrors](https://root.cern.ch/doc/master/classTGraphErrors.html): numeric CSV input and graph fitting.
- [ROOT HFitImpl](https://root.cern.ch/doc/master/HFitImpl_8cxx_source.html): one-sided parameter limits and covariance normalization for graphs without errors.
