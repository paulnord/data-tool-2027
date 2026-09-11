# Neutral chromium Rydberg series

[Data file](published-cri-rydberg.csv) · [Example documentation index](published-examples.md) · [Publication](https://doi.org/10.1016/j.rinp.2025.108368)

## Data and interpretation

31 energy values for principal quantum numbers 20–50. Energy and Y standard deviation use cm⁻¹. Use the final published article for the fit range and systematic uncertainty; the earlier preprint differs.

Fix R = 109736.157 cm⁻¹. The custom equation below gives IP = 54575.481261 ± 0.023707 cm⁻¹, d = 2.5516326 ± 0.0048868 and a = −9.670963 ± 1.582712. The publication reports IP = 54575.49 ± 0.02 (statistical) ± 0.03 (systematic), d = 2.552 ± 0.004 and a = −9.9 ± 1.3, with reduced χ² = 0.6315. Our reduced χ² is 0.621867.

Rescaling our IP standard error by √0.621867 gives about 0.0187 cm⁻¹, consistent with rounding to 0.02. Data Tool retains the supplied uncertainty scale. The common systematic 0.03 cm⁻¹ remains separate: treating it as independent noise on every energy would change the weights incorrectly.

The rounded R = 109736.16 triggered nonconvergence from the same starting values, while the precise value succeeded. SciPy converges with either value. This is an unresolved Data Tool convergence sensitivity, not evidence that the rounded constant has a large physical effect or that the measurements are invalid.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### chromium-precise-R

Equation: `IP-R/(x-d-a/(x-d)^2)^2`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `IP = 54575.49`, `R = 109736.157` (fixed), `d = 2.552`, `a = -9.9`.

Use all rows.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| IP | 54575.48126 | 0.02370706 |
| R | 109736.157 | fixed |
| d | 2.551632593 | 0.0048867828 |
| a | -9.670962837 | 1.5827117 |

Reduced weighted objective on selected rows: **0.621867208**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](published-examples.md) before comparing standard errors or goodness-of-fit statistics.
