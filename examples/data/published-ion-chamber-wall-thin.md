# Ionization chamber: thin walls

[Data file](published-ion-chamber-wall-thin.csv) · [Example documentation index](published-examples.md) · [Publication](https://doi.org/10.1088/0031-9155/47/10/308)

## Data and interpretation

Select only thicknesses 3.73, 3.97, 4.85 and 9.56 mm. The first five rows remain available for comparison but are excluded from parameter estimation. The table's response and uncertainty values were checked against Table 1.

For the ordinary linear model, X is column 1 (thickness). For the physical nonlinear model, select column 6, t*f(alpha), as X and fit a line in that coordinate. The tabulated transformation already incorporates the physical shape; no extra free shape parameter is fitted. Keep Y as column 2 and its combined standard uncertainty as column 3. The separate thickness and direct-response uncertainties are provenance; do not add the thickness contribution a second time.

The fitted coefficients closely reproduce the publication. Data Tool evaluates reduced χ² on the selected fit rows. As a separate check, evaluating the resulting linear and transformed models on all rows and dividing by N−2 gives 4.68764 and 0.186057 (publication: 4.4 and 0.17). Small differences remain; the two statistics should not be presented as identical. Selection explains why the selected-row statistic differs substantially from the all-row comparison.

The reported wall correction Kw is a derived physical quantity, not a fitted coefficient. It is not independently validated by the two parameter checks below.

## Reproduce the CSV calculation

Choose the custom equation and independent variable `x` shown below. All parameters are free except those explicitly fixed. Supply the indicated Y standard-deviation column and retain its absolute scale. Numerical errors are local, conditional standard errors; reading this page does not assert the assumptions in the application.

### thin-linear

Equation: `a+b*x`. X: column 1; Y: column 2; Y standard deviation: column 3.

Starting values: `a = 1`, `b = -0.005`.

Select X ≥ 3.7.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| a | 1.003156298 | 0.0014648726 |
| b | -0.006526539663 | 0.00022296344 |

Reduced weighted objective on selected rows: **0.334306444**.

### thin-transformed

Equation: `a+b*x`. X: column 6; Y: column 2; Y standard deviation: column 3.

Starting values: `a = 1`, `b = -0.005`.

Select X ≥ 6.

| Parameter | Reproduced value | Standard error |
| --- | ---: | ---: |
| a | 1.01279245 | 0.0017703309 |
| b | -0.005409674522 | 0.00018479512 |

Reduced weighted objective on selected rows: **0.272551591**.

These numerical results were independently checked with SciPy 1.18.1. See the [shared conventions and review scope](published-examples.md) before comparing standard errors or goodness-of-fit statistics.
