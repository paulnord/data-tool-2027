# Gaussian peak shape options

Choose **Gaussian peak** and enable **Allow skew**, **Adjust tail shape (kurtosis)**,
or both. Both off gives the ordinary four-parameter Gaussian. Each enabled option
initially frees one additional parameter; parameters can also be fixed independently.
These controls appear in the single-fit, model-comparison and multi-interval views.
They change the fitted peak, not the measurement uncertainty used for weighting.

The adjustable peak uses the sinh–arcsinh normal family of
[Jones and Pewsey (2009)](https://doi.org/10.1093/biomet/asp053), with an affine
reparameterization to keep the peak position and height directly interpretable:

```text
y = b + A h(z)/h(zm)
z = (x - mu)/w + zm
h(z) = cosh(u) exp(-sinh(u)^2/2) / sqrt(1 + z^2)
u = tail asinh(z) - skew
```

Here zm is the mode of h, b is the background, A is the peak height above that
background, and mu is the peak position. Negative A describes a dip. The positive
width scale w has X units; it is generally neither a standard deviation nor a
half-width. Skew and tail are dimensionless. Skew = 0 is symmetric; tail = 1
retains the Gaussian tail parameter, tail < 1 gives heavier tails, and tail > 1
gives lighter tails. Skew = 0 and tail = 1 exactly recover the Gaussian with w
equal to its standard deviation. Fixing tail = 1 while fitting skew does not
force zero excess kurtosis.

The report derives **Peak skewness** and **Peak excess kurtosis (Gaussian = 0)**
from the normalized peak after removing its background and amplitude. These are
standardized third and fourth central moments, not the raw fitting parameters
or moments of the measurement errors. They describe the entire fitted function,
including its extrapolated tails. Finite observations cannot directly determine
those tails. In particular, the adjustable family does not contain an exact
Lorentzian: the ideal normalized Lorentzian/Cauchy has undefined variance and
kurtosis ([NIST](https://itl.nist.gov/div898/handbook/eda/section3/eda3663.htm)).

The core brackets the unique mode in asinh coordinates and bisects 64 times;
its analytic Jacobian includes derivatives of the mode and peak normalization.
For derived moments, 128- and 256-point Gauss–Hermite rules integrate the
transformed standard normal. Values are reported only when both rules agree
within 1e-8 times one plus the absolute moment. Overflow or unresolved integration
produces an explicit unavailable result. Agreement is a numerical convergence
check, not a rigorous error bound for all possible shape parameters.

Moment standard errors use central differences and the complete fitted covariance
matrix, including correlation between skew and tail. They retain the existing
local linear approximation and inference restrictions. Fixed shape quantities
are labeled fixed; a zero-amplitude peak has undefined normalized moments.
If first-order sensitivity vanishes while a relevant shape parameter remains
free, the standard error is unavailable rather than labeled fixed.
Baseline, width and tail can be strongly correlated, so try different starting
values and inspect residuals and covariance before interpreting shape.

Independent references use SciPy least_squares, a Brent mode root, a three-point
Jacobian, SVD covariance, and adaptive quadrature for moments. Skew-only,
tail-only and joint fits are checked, along with the Gaussian limit, analytic
derivatives, and propagated moment uncertainties. Actual exported SciPy and ROOT
programs also reproduce all three fits and moments.

Sessions use the documented [current format](integration.md#one-session-format-v7--pre-beta-migration-2026-09-15).
Disabling both options returns to the ordinary Gaussian within the same session format. SciPy/ROOT exports
contain editable model, fit, plot and moment routines. **Edit as custom equation**
is unavailable for this model because the current custom-expression language
cannot express its mode-root calculation.

## Lorentzian reference uncertainties

The observations in `examples/data/lorentzian.csv` were generated from
`b = 0.2 V`, `A = 3 V`, `mu = 0.4 Hz` and `gamma = 0.6 Hz`, with independent
Gaussian deviations whose standard deviations are
`sigma_i = 0.02 (1 + i/81) V` for zero-based rows i = 0…80.
The CSV now includes those exact standard deviations as a third column; assign
it as **Y uncertainty** on import. The X/Y observations are unchanged.
With those weights the independent reference Lorentzian fit has
χ² = 61.82960687 for 77 degrees of freedom, or χ²/df = 0.8029819.
Using a common 0.02 V instead gives different weights and a much larger χ².
