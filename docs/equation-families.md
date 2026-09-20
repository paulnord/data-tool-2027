# Equation families and notation

The main analysis, model comparison, and multi-interval views use one model chooser. The first choices are Straight line and Polynomial. Polynomial opens a separate degree selector for 2–10; degrees 2–5 also show quadratic, cubic, quartic, and quintic. Other groups are exponentials, powers and logarithms, oscillations, and peaks and transitions. Constant acceleration is omitted from new choices: a quadratic supplies the same curve family. Saved constant-acceleration analyses retain their original equation and parameters.

**Settings → Features → Show advanced models and analysis tools** is off by default. It adds Custom equation, supplied-exponent Power law, Reciprocal, Logarithmic, Logistic sigmoid, adjustable Gaussian shape, Fourier series, and the alternative polynomial representations described below. It also reveals model comparison, multi-interval fitting, and collision analysis in the shared **Analysis tools** selector. The preference is local to the browser profile or desktop webview on that device; it is not scientific input and is not stored in `.trksess` files. Turning it off does not replace or hide an advanced model or analysis that is already active, including one restored from a session.

There is no universal shorthand across fitting libraries: [MATLAB](https://www.mathworks.com/help/curvefit/polynomial.html) uses `polyN`, [ROOT](https://root.cern.ch/manual/fitting/) uses `polN`, and [NumPy](https://numpy.org/doc/stable/reference/routines.polynomials.html) accepts a degree argument. The interface uses the explicit term degree (highest power). The line model retains `b + m*x`.

## Polynomial representations

Polynomial is one model family through degree 10. Advanced Features changes how its coefficients are represented without creating three different curve families:

- **Powers of x:** \(y=\sum_{i=0}^{N}c_i x^i\). Coefficient \(c_i\) has units Y/X\(^i\).
- **Taylor series:** \(y=\sum_{i=0}^{N}c_i(x-x_0)^i/i!\), at a fixed expansion center \(x_0\). Thus \(c_i\) represents the degree-\(i\) derivative at that center and has units Y/X\(^i\).
- **Chebyshev basis:** \(y=\sum_{i=0}^{N}c_iT_i((x-x_0)/s)\), with fixed center \(x_0\) and positive scale \(s\). Every coefficient has Y units.

When Taylor or Chebyshev is first selected, the interface suggests the midpoint of the available finite X values as the center and half their span as the Chebyshev scale (or scale 1 for a zero span). These values are then ordinary explicit model metadata: editing exclusions does not silently recalculate them. The center and scale are fixed, not fitted parameters, and are preserved in sessions and analysis-bundle metadata.

For a fixed degree, all three representations span the same polynomial curve space. When all coefficients are free (or fixed constraints have been transformed equivalently), a full-rank fit therefore has the same predictions, residuals, SSE or chi-square, degrees of freedom, and model-comparison parameter count. Their coefficient values, units, covariance entries, and numerical conditioning differ. Fixing the same numeric coefficient in two representations imposes different constraints. The representations should not be treated as three competing physical models in model comparison.

## Fixed-period Fourier series

The advanced **Fourier series** model is

\[
y=b+\sum_{k=1}^{H}\left[s_k\sin\left(\frac{2\pi k(x-x_0)}{T}\right)+c_k\cos\left(\frac{2\pi k(x-x_0)}{T}\right)\right],
\]

with 1–5 harmonics. The positive period \(T\) and origin \(x_0\) are explicit fixed model metadata; only \(b,s_k,c_k\) are fit. All fitted coefficients have Y units. The model is linear in those coefficients and is solved by the same QR path as other basis models. It does not search for a period, choose the harmonic count, or claim that a periodic interpretation is physically appropriate. When every harmonic coefficient is free, changing the origin rotates the sine/cosine coefficients while leaving the fixed-period curve space unchanged; fixed numeric coefficients are representation-specific constraints.

## Exponentials, peaks and transitions

- Exponential decay: `y = b + A*exp(-x/tau)`.
- Exponential growth: `y = b + A*exp(x/tau)`.
- Logistic sigmoid: `y = b + A/(1 + exp(-(x-x0)/w))`.
- Gaussian and Lorentzian peaks remain separate choices.

Time constants and widths are positive. Fix tau to specify the exponential rate (tau = 1/abs(k)), or fix b when an offset is known. With negative A the decay model can describe approach to an upper asymptote. In the sigmoid, b and b+A are the two asymptotes, x0 is the midpoint, and w is the transition scale. Negative A gives a falling transition. Growth and sigmoid use analytic Jacobians and the existing local QR-based nonlinear optimizer. Sigmoid evaluation avoids exponential overflow on either tail. When all nonlinear shape parameters are fixed, the remaining fit is linear in its coefficients.

The model chooser has one **Sinusoid** entry. It fits T, or uses a supplied period when **Fix T** is checked. The sine/cosine parameterization is retained internally; amplitude and phase are derived with covariance propagation. Old supplied-period sine sessions remain readable and editable, without automatic parameter conversion.

## Units and familiar notation

Displayed equations, help, and reports use `b + a/x`, `b + a*ln(x)`, and `b + a*x^p` (or fitted exponent n). For logarithmic and power-law fits, x denotes its numerical value in the selected x-unit: this is the existing implicit normalization by one declared unit. Changing that unit changes the logarithmic intercept or power-law amplitude; it does not silently convert observations. The reciprocal coefficient a has units of y times x. All three retain the existing positive-x domain requirement. User-authored custom expressions are preserved exactly.

## Numerical limits and compatibility

Polynomial and fixed-period Fourier series use the existing column-scaled, pivoted, twice-reorthogonalized QR algorithm. There are up to 11 coefficients: degree 10 has 11, and five Fourier harmonics have one background plus ten sine/cosine coefficients. Positive residual degrees of freedom require more included observations than free identifiable coefficients. More rows alone do not guarantee numerical rank. Large offsets in X, narrow spans, clustered phase coverage, and high degrees or harmonic counts can produce poorly determined coefficients or explicit rank rejection. A centered or scaled basis can improve numerical behavior, but does not add information or make a high-order model scientifically justified. The solver reports its rank diagnostics; it does not silently lower the degree or harmonic count. High-degree polynomials can extrapolate poorly, while a fixed-period Fourier series is periodic outside the observed range.

Custom equations retain their existing eight-parameter limit. Conversion to a custom equation is disabled for degree 8–10 polynomials and Fourier series with four or five harmonics, whose 9–11 coefficients exceed it. They still support fixed coefficients, uncertainty controls, reports, comparison, and SciPy/ROOT exports.

[Session v7](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15) covers every equation and workspace. Powers of x canonically omits representation metadata, so an ordinary polynomial save retains the pre-existing v7 settings shape. The parser also accepts an explicit power marker and removes it on the next save. Taylor, Chebyshev, and Fourier metadata require a build that implements those advanced choices. Independent tests compare the three same-degree polynomial representations, exercise Fourier recovery and rank failure, and round-trip the fixed basis metadata. The existing reference fixtures in `tests/fit/extended-model-reference.json` use SciPy least squares, complex-step Jacobians, and SVD covariance for the other extended models. These are numerical validation cases, not a claim that every dataset or nonlinear starting point will converge.

Bessel-function models and graphs that decompose a fitted curve into individual terms are deferred. They need an explicit model contract, domains and normalization, independent numerical references, and a consistent presentation across single-fit, comparison, and interval workspaces before they can be offered as fit choices.

## Peak shape

Gaussian peaks offer optional skew and tail controls, with derived skewness and
excess kurtosis. Both off gives an ordinary Gaussian; see [peak shape definitions,
validation and limits](peak-shapes.md). These settings are shared across analysis
views and preserved in session v7 and SciPy/ROOT exports.

## Number display

Numeric results and controls switch to scientific notation for nonzero magnitudes below 0.0001 (more than three leading zeros after the decimal point). For example, 0.0001 stays decimal and 0.00003594 displays as 3.594e-5. Large results use scientific notation from 10^7; graph ticks may use it earlier to keep axes readable. Result displays use up to seven significant digits. Editable controls preserve complete numeric values and unfinished typing; this display rule does not round stored observations, fit parameters, or exported data.
