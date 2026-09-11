# Ba-137m radioactive decay

[Data file](ba137m-decay.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.3938/jkps.65.532)

## Data and interpretation

Ten net counting rates with supplied Y standard deviations and elapsed time in minutes. Keep the raw-count column as provenance; fit the net rate. Use a zero-background exponential because the rates are already background-subtracted.

The CSV gives decay constant k = 0.2518869 ± 0.0232339 min⁻¹ and half-life ln(2)/k = 2.7518 ± 0.2538 min, using local propagation of the standard error. Reduced χ² = 0.182921.

The inherited header reports an ensemble half-life of 2.577 ± 0.009 min from five runs. That is not the expected result or uncertainty for these ten rows. The header's former claim that a decay constant of 0.32 min⁻¹ corresponds to a half-life of 2.6 min was internally inconsistent: ln(2)/0.32 is about 2.17 min. That interpretation has been removed.

A common subtracted background can correlate net rates. The diagonal-error calculation here does not estimate that correlation. Equal 60-s integration intervals change the exponential amplitude but not its decay constant, provided interval timing is consistent.

The publisher's accessible abstract was checked, but its full measurement table was not accessible during this review. Numerical agreement with SciPy verifies the supplied CSV calculation, not an independent row-by-row transcription audit of this dataset.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### ba137m

Equation: `A*exp(-k*x)`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `A = 174`, `k = 0.27`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| A | 173.6972532 | 11.681529 |
| k | 0.2518868898 | 0.023233898 |

Reduced weighted objective on selected rows: **0.182920786**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](README.md) before comparing standard errors or goodness-of-fit statistics.
