# Pulsar photon index versus surface temperature

[Data file](published-pulsar-photon-index-vs-temperature.csv) · [Example documentation index](published-examples.md) · [Publication](https://doi.org/10.1093/mnras/stab025)

## Data and interpretation

12 rows. X is log10(T) with T expressed in eV/k; Y is the dimensionless photon index. Crucially, column 3 is X standard deviation and column 4 is Y standard deviation. Select column 4 for Y uncertainty; do not use the usual third-column mapping.

Data Tool currently minimizes vertical Y residuals and does not implement orthogonal distance regression (ODR). Keeping an X-error column in the table does not include it in the objective. The Y-only result below is therefore a comparison calculation, not a reproduction of the paper's method.

| Calculation | Intercept | Slope | Reduced objective |
| --- | ---: | ---: | ---: |
| Data Tool, Y-only | 4.292729 ± 0.192533 | −1.146350 ± 0.091150 | 17.13063 |
| Independent SciPy ODR, X and Y errors | 4.318514 ± 0.663489 | −1.225742 ± 0.313449 | 9.56841 |
| Published ODR | 4.32 ± 0.66 | −1.23 ± 0.31 | 9.55 |

The ODR standard errors in this comparison are residual-rescaled; Data Tool's Y-only errors are unscaled. ODR closely reproduces the publication. Both the treatment of X errors and the uncertainty scaling matter. This is an explained method difference, not evidence of a publication error.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### photon-y-only

Equation: `a+b*x`. X: column 1; Y: column 2; Y standard deviation: column 4.

Starting values: `a = 4`, `b = -1`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| a | 4.292729102 | 0.19253269 |
| b | -1.146349656 | 0.09114969 |

Reduced weighted objective on selected rows: **17.1306298**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](published-examples.md) before comparing standard errors or goodness-of-fit statistics.
