# Landau peak

Enable **Settings → Features → Show advanced models and analysis tools**,
then choose **Landau peak** under Peaks and transitions. The model is

`y = b + (A/w) * landau((x-mpv)/w)`.

- `mpv` is the peak position, in x-units.
- `w > 0` is the Landau scale in the ROOT width convention, in x-units.
  It is not a standard deviation: the ideal Landau distribution has no finite
  mean or variance. Skewness and kurtosis are likewise undefined.
- `A` is the signed area above background over the whole real line,
  in y-unit × x-unit. It includes the long tail outside the observed range;
  it is not peak height or automatically the number of histogram entries.
- `b` is a constant background in y-units. It starts fixed at zero;
  uncheck **Fix b** to fit it.

`landau(z)` is a normalized density with its mode at zero. It is also available
in custom equations, including **Edit as custom equation**. Custom equations
do not inherit the built-in positive-width constraint. The built-in model
provides width validation and data-based initial guesses.

This is a plain Landau curve, with no Gaussian convolution. Fits use the
existing weighted least-squares objective and local nonlinear solver. Sampled
histogram counts are not automatically treated as bin integrals or with a
Poisson likelihood. Fit uncertainties use the same local Jacobian conventions
as the other nonlinear models. Selecting a model or opening an example does
not run a fit.

## Example

Choose **Data… → Examples → Synthetic data → Landau peak**, then **Fit selected
observations**. The ready-to-fit `examples/data/landau.trksess` assigns the
uncertainty column and supplies starting values. It remains usable with the
advanced-features preference off. The companion `examples/data/landau.csv`
can also be opened as ordinary data; assign its third column as Y uncertainty
and choose the model explicitly.

These are 101 synthetic curve observations, not measured detector data or
Poisson counts. The generating parameters are `b=0 V`, `A=150 V·keV`,
`mpv=50 keV`, and `w=5 keV`. Independent Gaussian noise has the stated per-row
standard deviation. The seed, generator, library versions, and source are
recorded in both files. Regenerate them with
`python3 scripts/generate-landau-reference.py` (NumPy and SciPy ≥ 1.15).

## Evaluation and exports

The browser ports the 53-bit piecewise rational PDF from
[Boost.Math](https://github.com/boostorg/math/blob/develop/include/boost/math/distributions/landau.hpp)
with analytic derivatives of every region and an explicit scale/mode conversion.
It does not numerically integrate a convolution. Attribution and the Boost
Software License are in `public/THIRD_PARTY_NOTICES.md`.

Let `k=2/pi` and `m=-0.42931452986133525`, the mode of the scale-one Boost/SciPy
density. Data Tool defines `landau(z)=k*scipy.stats.landau.pdf(k*z+m)`.
Python exports use this wrapper and require SciPy ≥ 1.15; SciPy uses Boost
internally. ROOT exports use `TMath::Landau(z+r,0,1,true)`, where
`r=m/k+log(pi/2)≈-0.222782981256408`. Thus the fitted MPV, width and area retain
their meanings across exports. ROOT's older approximation has lower numerical
precision, so bitwise equality is not expected. Exported fitters estimate
derivatives numerically; the browser uses analytic derivatives.

Validation includes independent `scipy.stats.levy_stable` quadrature values,
full-line normalization, mode position, derivative checks on both sides of
approximation boundaries and across width scales, and independent SciPy
least-squares optima and SVD covariance with free/fixed parameters. These checks
cover the specified examples and numerical regimes, not arbitrary data quality
or global-optimum guarantees.

The built-in and custom-equation examples have also been executed with SciPy
1.17.0 and ROOT 6.40.00. The export check compares selected observations,
fitted coefficients, objectives and degrees of freedom. ROOT Landau coefficients
use a relative tolerance of one part per million plus `1e-6` absolute, reflecting
the different PDF approximation and optimizer. In a 3,001-point PDF check from
`z=-5` to `z=1e6`, the largest absolute difference between the SciPy and ROOT
wrappers was `3.84e-10`; the largest relative difference was `3.94e-7`.

References:

- [SciPy Landau distribution](https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.landau.html)
- [ROOT Landau–Gaussian tutorial](https://root.cern.ch/doc/master/langaus_8C.html), documenting ROOT's Landau mode shift.
- [Boost.Math Landau implementation](https://github.com/boostorg/math/blob/develop/include/boost/math/distributions/landau.hpp)
