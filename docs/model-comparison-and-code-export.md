# Model comparison, fit guides and code export

Model guides and source-code output are presentation/export choices. Model
comparison is an in-memory workspace that refits its candidates; it does not
cache fitted results in a `.trksess` file. These features introduce no additional
protocol fields. Added equation families use the documented [session-v4 migration](integration.md#session-v4-for-additional-model-families--2026-09-14);
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

For a falling sigmoid, b + A is below b; the labels specify the parameter values rather than assuming an upper/lower ordering. Guide labels sit above the plotting frame, keyed by interval or comparison candidate. Explicit axis limits clip guides normally; vertical center markers do not expand the x range or change automatic y limits. The existing guide toggle controls all of these references. Comparison candidates retain their own guide colors and fitted reference values. SciPy/ROOT scripts carry the corresponding guides when enabled, including candidate bundles. Custom equations and other built-ins have no automatic reference guides.

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

Choose **Analysis → Model comparison…** before or after fitting. The opened data
appear immediately above the observations table. Opening or editing the main
source data refreshes every comparison candidate while retaining the selected
models. Switching analysis views alone preserves candidate settings and results.

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

**Save candidate sessions (.zip)** writes one validated standard `.trksess` file
per candidate. Load the individual files into candidate panels to restore their
inputs and refit. Candidate labels and display preferences are not session fields;
no new request/session protocol is introduced. The SciPy and ROOT exports include
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

After a single fit, choose **Export → Python / SciPy analysis bundle (.zip)** or
**Export → C++ / ROOT analysis bundle (.zip)**. Each ZIP contains only the selected
program, its instructions, and the shared CSV and metadata.
The downloaded archive expands into one named directory containing:

- `data.csv` — row identity, X, Y, sigma, inclusion, and missing-value reason;
- `analysis.json` — a versioned manifest with provenance, units, assumptions,
  uncertainty model, fit setup, Data Tool result, graph choices, and outputs;
- `fit_scipy.py` — the generated analysis (SciPy export);
- `requirements.txt` — NumPy, SciPy, and Matplotlib dependencies (SciPy export);
- `fit_root.C` — the generated analysis (ROOT export); and
- `README.md` — dependencies, the CSV contract, and exact run commands.

The observations are never compiled into either program. Both read `data.csv`
at execution and accept another compatible CSV path, making the export suitable
for a repeated or batch workflow. Blank numeric cells represent missing values;
the `included` column remains a separate scientific choice rather than being
inferred from whether a row appears in the file.

### Python/SciPy

Run in the extracted directory with NumPy, SciPy and Matplotlib:

```bash
python3 -m pip install -r requirements.txt
python3 fit_scipy.py
```

The script reads both `data.csv` and `analysis.json`, refits with
`scipy.optimize.curve_fit`, prints parameter values and standard errors, draws
the data/fit/residuals, and saves a PNG. Plot display is opt-in with `--show`, so
the default is suitable for unattended execution. Reuse the generated model
with another table or output path without editing source:

```bash
python3 fit_scipy.py --data another-run.csv --output another-fit.png
```

Supplied sigma uses `absolute_sigma=True`. Unknown equal scatter uses SciPy's
residual-scaled covariance. The program starts from the recorded starting values
rather than using Data Tool's solution as the optimizer start. It compares
coefficients with Data Tool only when using the bundled CSV and manifest.
`--analysis` can select compatible metadata, but its model, parameter order,
custom expression, and equation-defining options must match the generated
program. To change the equation, generate a new bundle. Scalar custom models
are broadcast over the data and plotting coordinates.

### C++/ROOT

Run the macro from the extracted directory:

```bash
root -l fit_root.C
```

For another table and output stem:

```bash
root -l 'fit_root.C("another-run.csv","another-fit")'
```

The macro parses quoted CSV records and uses `TGraphErrors`, a local-lambda
`TF1`, `ROOT::Fit::Fitter` with Minuit2, `TFitResult`, and a `TCanvas`.
It fits in physical parameter coordinates and uses one-sided limits for strictly
positive parameters, avoiding an artificial enormous upper bound. It applies
parameter starts, names, fixed values and physical/search bounds; prints coefficients,
covariance-derived errors and fit statistics; draws included/excluded data, the
fitted curve, optional guides and residuals; and saves both a PDF and a `.root`
file containing the graph, fit, result and canvas objects.

Supplied uncertainties are fitted directly. For unknown equal scatter the macro
first obtains the unweighted solution, calculates
\(s=\sqrt{\mathrm{SSE}/df}\), assigns that uniform Y error and refits so ROOT's
covariance scale matches Data Tool's convention. Zero SSE or nonpositive
residual degrees of freedom leaves standard errors explicitly unavailable;
a provisional unit-error covariance is not reported as statistical uncertainty.
Unsupported statistical assumptions also withhold standard errors. ROOT's raw
minimizer result is then saved as `numerical_fit_result` with an explanatory title.
The macro checks convergence status, covariance quality, and finite results before
writing successful fit artifacts. ROOT and Data Tool can still
differ for nonlinear optimization and numerical rank decisions. Data Tool does
not bundle or execute Python, SciPy, or ROOT.

The restricted custom-equation syntax is translated from its validated syntax
tree for both languages. Raw equation text is never pasted into executable
source as JavaScript or by textual name substitution.

## Verification

Core tests cover likelihood conventions, finite extreme-sigma normalizers,
unit-invariant phase, custom equation translation and export structure. Browser
checks cover staged comparison persistence, aligned responsive frames, small
residuals, and hidden-residual layout. `npm run test:code-exports` executes the
generated programs when SciPy/Matplotlib and ROOT are installed. It checks fitted
coefficients, ROOT status and uncertainty availability across representative
linear, nonlinear, fixed-parameter and custom models, and checks rejected input.
Successful artifact creation alone is not evidence of a successful fit.

Source notes are retained as leading `# ` comment lines in `data.csv`; both generated readers skip this preamble. ROOT keeps a cloned graph window open after the macro returns. Use `.q` to quit, or `root -l -b -q fit_root.C` for batch output without a window.

The fitted equation is the first function in each generated source. Python's
`main()` loads metadata with `load_model`, loads observations with `load_data`,
calls `fit_data`, and then `report_fit` and `plot_fit`. Importing the Python file
only defines functions. ROOT's `fit_root()` provides the same orchestration;
`load_model` contains its generated equation settings and parameter constraints.
ROOT retains `analysis.json` for reference but does not read it at runtime.
Python dependencies are included only in the SciPy export.
