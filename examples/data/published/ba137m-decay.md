# Ba-137m radioactive decay

[Data file](ba137m-decay.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.3938/jkps.65.532)

**Reproduction status: comparison.** This is the paper's complete representative trace, not the five-run dataset behind its ensemble result.

## Data and interpretation

Ten net counting rates with supplied Y standard deviations and elapsed time in minutes. Keep the raw-count column as provenance; fit the net rate. Use a zero-background exponential because the rates are already background-subtracted.

The CSV gives decay constant k = 0.2518869 ± 0.0232339 min⁻¹ and half-life ln(2)/k = 2.7518 ± 0.2538 min, using local propagation of the standard error. Reduced χ² = 0.182921.

The paper reports an ensemble half-life of 2.577 ± 0.009 min from five runs. It publishes this complete 10-row representative trace, but not the other four run-level datasets or enough detail to reconstruct the weighted combination. The ensemble value is therefore not an expected result or uncertainty for these ten rows and cannot be independently reproduced from the article alone.

The paper also describes a rounded semilog slope of −0.32 min⁻¹, which corresponds to a half-life of about 2.17 min, not 2.6 min. That approximate graphical calculation is distinct from both this weighted nonlinear fit and the five-run ensemble.

A common subtracted background can correlate net rates. The diagonal-error calculation here does not estimate that correlation. Equal 60-s integration intervals change the exponential amplitude but not its decay constant, provided interval timing is consistent.

The configured session uses the equivalent half-life parameterization `R0*exp(-ln(2)*t/T12)` and returns `T12 = 2.7518 ± 0.2538 min`. Numerical agreement with SciPy verifies this stated calculation; it does not supply the four missing runs.

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
