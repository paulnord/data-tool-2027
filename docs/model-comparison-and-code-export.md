# Model comparison, fit guides and code export

These tools extend a single fitted dataset without changing the request or
session formats. Model guides and source-code output are presentation/export
choices. Model comparison is an in-memory workspace that refits its candidates;
it does not cache fitted results in a `.trksess` file.

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
refit. Other models currently provide no guides.

Sine-family diagnostics report amplitude
\(A=\sqrt{s^2+c^2}\), phase \(\phi=\operatorname{atan2}(c,s)\) for
\(A\sin(2\pi x/T+\phi)\), and frequency \(f=1/T\). Their standard errors use
first-order propagation through the complete fitted covariance, including the
covariance between `s` and `c`. Phase is relative to the dataset's current X
origin and is explicitly unavailable when the amplitude is numerically zero.
Separate `s sin(...)` and `c cos(...)` curves are not drawn because that
decomposition also changes when the X origin changes.

## Comparing fitted models

Choose **Analysis → Model comparison…**. Candidate 1 starts with the current
analysis and uses its fitted coefficients as warm starts; Candidate 2 starts
with a simple alternative. Either candidate can select another built-in model
or load a validated `.trksess` file. Loading is staged inside the comparison
workspace: a malformed or incompatible file does not replace the main analysis.
Both candidates are refitted when **Refit and compare** is pressed. A loaded
session uses its recorded starting and fixed parameter values because sessions
do not cache fitted results.

Formal comparison is blocked unless both candidates have exactly the same
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

AICc is unavailable when \(n\le K+1\). Delta AICc and Akaike weights are
computed when at least two candidates have an available AICc. They describe
relative support only within that candidate set and are not probabilities that
a model is true. If assumptions make the underlying fits descriptive only,
formal likelihood criteria are unavailable rather than presented with false
precision.
Nonlinear convergence, local-minimum and conditioning warnings remain visible.

## SciPy/ROOT analysis bundle

After a single fit, choose **Export → SciPy / ROOT analysis bundle (.zip)**.
The downloaded archive expands into one named directory containing:

- `data.csv` — row identity, X, Y, sigma, inclusion, and missing-value reason;
- `analysis.json` — a versioned manifest with provenance, units, assumptions,
  uncertainty model, fit setup, Data Tool result, graph choices, and outputs;
- `fit_scipy.py` — the generated NumPy/SciPy/Matplotlib analysis;
- `fit_root.C` — the generated C++/ROOT analysis; and
- `README.md` — dependencies, the CSV contract, and exact run commands.

The observations are never compiled into either program. Both read `data.csv`
at execution and accept another compatible CSV path, making the export suitable
for a repeated or batch workflow. Blank numeric cells represent missing values;
the `included` column remains a separate scientific choice rather than being
inferred from whether a row appears in the file.

### Python/SciPy

Run in the extracted directory with NumPy, SciPy and Matplotlib:

```bash
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

### C++/ROOT

Run the macro from the extracted directory:

```bash
root -l -q fit_root.C
```

For another table and output stem:

```bash
root -l -q 'fit_root.C("another-run.csv","another-fit")'
```

The macro parses quoted CSV records and uses `TGraphErrors`, a local-lambda
`TF1`, `TFitResultPtr`, and a `TCanvas`. It applies parameter starts, names,
fixed values and physical/search bounds; prints coefficients,
covariance-derived errors and fit statistics; draws included/excluded data, the
fitted curve, optional guides and residuals; and saves both a PDF and a `.root`
file containing the graph, fit, result and canvas objects.

Supplied uncertainties are fitted directly. For unknown equal scatter the macro
first obtains the unweighted solution, calculates
\(s=\sqrt{\mathrm{SSE}/df}\), assigns that uniform Y error and refits so ROOT's
covariance scale matches Data Tool's convention. ROOT and Data Tool can still
differ for nonlinear optimization and numerical rank decisions. Data Tool does
not bundle or execute Python, SciPy, or ROOT.

The restricted custom-equation syntax is translated from its validated syntax
tree for both languages. Raw equation text is never pasted into executable
source as JavaScript or by textual name substitution.
