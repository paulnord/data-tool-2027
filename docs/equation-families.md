# Equation families and notation

The main analysis, model comparison, and multi-interval views use one model chooser. The first choices are Straight line, Polynomial, and Custom equation, in that order. Polynomial opens a separate degree selector for 2–10; degrees 2–5 also show quadratic, cubic, quartic, and quintic. Other groups are exponentials, powers and logarithms, oscillations, and peaks and transitions. Constant acceleration is omitted from new choices: a quadratic supplies the same curve family. Saved constant-acceleration analyses retain their original equation and parameters.

There is no universal shorthand across fitting libraries: [MATLAB](https://www.mathworks.com/help/curvefit/polynomial.html) uses `polyN`, [ROOT](https://root.cern.ch/manual/fitting/) uses `polN`, and [NumPy](https://numpy.org/doc/stable/reference/routines.polynomials.html) accepts a degree argument. The interface uses the explicit term degree (highest power), with coefficients in ascending order: `c0 + c1*x + … + cN*x^N`. The line model retains `b + m*x`.

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

Polynomials use the existing column-scaled, pivoted, twice-reorthogonalized QR algorithm. There are up to 11 coefficients; positive residual degrees of freedom require more included observations than free identifiable coefficients. More rows alone do not guarantee numerical rank. Large offsets in x, narrow spans, and high degrees can produce poorly determined coefficients or explicit rank rejection. The solver reports its rank diagnostics; it does not change the x origin or silently lower the degree. High-degree polynomials can extrapolate poorly.

Custom equations retain their existing eight-parameter limit. Conversion to a custom equation is disabled for degree 8–10 polynomials, whose 9–11 coefficients exceed it. They still support fixed coefficients, uncertainty controls, reports, comparison, and SciPy/ROOT exports.

[Session v7](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15) covers every equation and workspace. Independent reference fixtures in `tests/fit/extended-model-reference.json` are generated with SciPy least squares, complex-step Jacobians, and SVD covariance. Checks cover fitted and fixed coefficients, starting suggestions, analytic derivatives, rank failure, positive widths, and session boundaries. These are numerical validation cases, not a claim that every dataset or nonlinear starting point will converge.

## Peak shape

Gaussian peaks offer optional skew and tail controls, with derived skewness and
excess kurtosis. Both off gives an ordinary Gaussian; see [peak shape definitions,
validation and limits](peak-shapes.md). These settings are shared across analysis
views and preserved in session v7 and SciPy/ROOT exports.

## Number display

Numeric results and controls switch to scientific notation for nonzero magnitudes below 0.0001 (more than three leading zeros after the decimal point). For example, 0.0001 stays decimal and 0.00003594 displays as 3.594e-5. Large results use scientific notation from 10^7; graph ticks may use it earlier to keep axes readable. Result displays use up to seven significant digits. Editable controls preserve complete numeric values and unfinished typing; this display rule does not round stored observations, fit parameters, or exported data.
