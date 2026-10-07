# Moyal peak

Enable **Settings → Features → Show advanced models and analysis tools**, then
choose **Moyal peak**. The model is

`y = b + (A/w) * moyal((x-mpv)/w)`,

where `moyal(z) = exp[-(z + exp(-z))/2] / sqrt(2*pi)` has unit area and mode zero.

- `mpv` is the peak position in x-units.
- `w > 0` is the Moyal scale in x-units, not its standard deviation.
- `A` is signed full-curve area above background, in y-unit × x-unit.
  It is not peak height; a negative area describes a dip.
- `b` is a constant background in y-units, initially fixed at zero.

This standard Moyal has a fixed asymmetric shape and an exponential right tail.
It can approximate the central shape of a Landau-like peak, but has a lighter
far-right tail than a Landau. It does not separate detector resolution from
energy-loss broadening and is not a Landau–Gaussian convolution. There is no
additional skew parameter. The existing weighted least-squares fit and local
covariance conventions apply; histogram bins are not automatically integrated
or fitted with a Poisson likelihood.

## FWHM and guides

The results, CSV report, and print report include **Full width at half maximum
(FWHM)** in x-units. Half height is measured relative to `b`, including for dips.
The roots of `z + exp(-z) = 1 + 2*ln(2)` are approximately
`zLeft = -1.3063401677698052` and `zRight = 2.284465930025749`. Thus

`FWHM = (zRight - zLeft)*w = 3.590806097795554*w`.

Its standard error is the same factor times the standard error of `w`. This
linear transformation uses the fitted covariance and introduces no extra fit
parameter. A fixed width is marked fixed; unavailable covariance stays
unavailable. A zero-area curve has no measurable peak and no reported FWHM.

Enable **Show fit guides when available** to see the MPV, the two asymmetric
half-height crossings, and the half-height level. Their separation is the FWHM.
The shared guides also appear in comparison, interval, print, and graph exports.

## Example and exports

Open **Data… → Examples → Synthetic data → Moyal peak**, then click **Fit selected
observations**. The ordinary files `examples/data/moyal.trksess` and `moyal.csv`
contain integer channels 0–100 and nonnegative integer counts. The generator
integrates a Moyal distribution over unit-width bins, then draws independent
Poisson counts. It uses 10,000 expected events, zero background, `mpv=50 channel`,
and `w=5 channel` (generating FWHM about `17.954 channel`). The recorded seed gives
9,854 observed events, including 37 empty channels. These are synthetic counts,
not measured detector data.

The assigned error is `sqrt(N)` counts for `N>0`, and **1 count for an empty
channel**, so zero observations retain finite weight. This is an observed-count
error estimate, not an exact Poisson confidence interval. The fit uses weighted
least squares at channel centers, not a Poisson likelihood or bin-integrated
model; sparse counts can bias this approximation. Gaussian/model assumptions
remain unconfirmed. The session enables conditional inference so parameter and
FWHM standard errors are explicitly approximate. When importing the CSV, assign
the third column as Y uncertainty and select the model explicitly.
Both files record the seed and generator. Regenerate using
`python3 scripts/generate-moyal-reference.py` with NumPy and SciPy installed.

The browser evaluates the closed-form density with analytic derivatives.
Python and ROOT exports use the same expression with NumPy and standard C++
math functions, respectively; no Boost distribution implementation is needed.
The exported fitters use their existing numerical derivatives.

`moyal(z)` is also available in custom equations and **Edit as custom equation**.
Conversion preserves parameter values and fixed flags. Custom equations do not
inherit built-in positive-width constraints, FWHM reporting, or model guides.

Validation checks SciPy density values, full-line normalization, mode position,
analytic derivatives over multiple width scales, and independent SciPy
least-squares optima and SVD covariance with free and fixed parameters. FWHM
checks cover the half-height equation, units, background and area invariance,
and uncertainty propagation.

Reference: [SciPy Moyal distribution](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.moyal.html),
which cites J. E. Moyal, “Theory of ionization fluctuations,” _Philosophical
Magazine_ **46** (1955), 263–280.
