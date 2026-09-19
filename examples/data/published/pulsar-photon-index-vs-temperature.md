# Pulsar photon index versus surface temperature

[Data file](pulsar-photon-index-vs-temperature.csv) · [Example documentation index](README.md) · [Publication](https://doi.org/10.1093/mnras/stab025)

**Reproduction status: unsupported method.** The source data are useful in Data Tool, but the publication's fit is not a Data Tool validation case.

## Data and interpretation

The 12 rows contain the logarithm of fitted surface temperature, non-thermal X-ray photon index, and uncertainties in both coordinates. The paper reports

`Gamma = (4.32 +/- 0.66) - (1.23 +/- 0.31)*log10(T)`

with reduced chi-square 9.55. It obtained that result with orthogonal-distance regression (ODR), which includes uncertainty in both X and Y.

Data Tool currently minimizes vertical Y residuals and treats X as exact. Loading this CSV therefore preserves and displays the measurements, but selecting the Y-uncertainty column does **not** reproduce the paper's objective. The X-uncertainty column remains provenance data.

As a comparison, a Y-only weighted line fit to these rows gives intercept 4.292729, slope -1.146350 and reduced chi-square 17.13063. The difference is expected because it is a different statistical model, not evidence of a solver failure.

This is a useful method-identification exercise: students should recognize from the supplied X errors that a Y-only fit is insufficient, then use an ODR-capable program for a publication-level comparison.
