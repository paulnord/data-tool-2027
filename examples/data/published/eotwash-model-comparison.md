# Eöt-Wash residual torque: model comparison

[Openable session](eotwash-model-comparison.trksess) · [CSV data](eotwash-model-comparison.csv)

Source: Aditi Krishak and Shantanu Desai, *Model Comparison tests of modified gravity from the Eöt-Wash experiment*, JCAP 07 (2020) 006, [DOI](https://doi.org/10.1088/1475-7516/2020/07/006), [public manuscript, v3](https://arxiv.org/abs/2003.10127v3). The numerical publication comparisons below refer to that manuscript's Tables 1 and 3.

Status: **Comparison**. This reproduces the public-data likelihood calculation closely, but does not reproduce every published parameter or information-criterion entry.

## Open and run

Open `eotwash-model-comparison.trksess` in Data Tool and choose **Use these data**, then **Refit and compare**. The session opens Model comparison directly, with four named candidate tabs, the same 87 observations and supplied uncertainty column, and the fixed-phase parameter locked. Loading it does not enable the device's Advanced features preference. Enable Settings → Advanced features if you also want the analysis-tools selector.

The session accepts conditional inference so that AIC is available immediately. Independent Gaussian errors and model adequacy remain explicitly unknown, not verified facts. All 87 rows are included. Residuals and error bars are enabled. No fitted results are cached in the session; Data Tool recalculates them.

## Data provenance

The CSV preserves all three numeric tokens and row order from the authors' [Data.txt at commit eb414d446b30fbf7d5d6a515f9751bcc49d0e2ec](https://github.com/aditikrishak/EotWash_analysis/blob/eb414d446b30fbf7d5d6a515f9751bcc49d0e2ec/Data.txt), accessed 2026-09-21. The three columns are separation in mm, residual torque in fN·m, and its supplied standard uncertainty in fN·m. Duplicate separations are retained as separate observations. The file contains residuals from three experimental configurations, not unprocessed torque measurements. No points are removed, combined or reconstructed from an image for this example.

These are the secondary analysis authors' published inputs. Their availability does not establish that they are unrounded original measurements or that their errors fully describe systematic effects and correlations.

## Candidate equations and starting values

| Candidate | Equation | Starting values | Free parameters |
| --- | --- | --- | ---: |
| Constant offset | `C` | C = 0.0001 fN·m | 1 |
| Exponential (Yukawa ansatz) | `B*exp(-m*(x-0.0566733518))` | B = 0.08 fN·m; m = 400 mm⁻¹ | 2 |
| Cosine, fixed phase | `A*cos(m*x+phi)` | A = 0.0042 fN·m; m = 65.29 mm⁻¹; phi fixed at 3π/4 rad | 2 |
| Cosine, free phase | `A*cos(m*x+phi)` | A = 0.0042 fN·m; m = 65.29 mm⁻¹; phi = 2.38 rad | 3 |

The exponential is exactly the paper's `alpha*exp(-m*x)`, reparameterized with B = alpha·exp(−m·r₀), r₀ = 0.0566733518 mm. This keeps its amplitude near the observed torque scale. The pivot is fixed and adds no free parameter. The cosine fits start near the paper's frequency region; this is a local reproduction, not a guarantee of the global minimum over every frequency.

## Numerical targets

Data Tool and an independent SciPy `least_squares` calculation agree on the following objectives and information criteria, using absolute supplied errors and the normalized Gaussian likelihood. NDF = 87 minus the free curve-parameter count.

| Candidate | χ² | NDF | χ²/NDF | AIC | Calculated AICc | Paper's AICc |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Constant | 85.516719 | 86 | 0.994380 | −571.339478 | −571.292419 | −571.3 |
| Exponential | 82.067540 | 85 | 0.965500 | −572.788657 | −572.645799 | −572.6 |
| Cosine, fixed phase | 70.732977 | 85 | 0.832153 | −584.123219 | −583.980362 | −584.0 |
| Cosine, free phase | 70.728918 | 84 | 0.842011 | −582.127278 | −581.838121 | −582.1 |

Data Tool uses **AIC**, not AICc, for supplied known variances. The extra AICc column above applies the paper's stated correction, 2k(k+1)/(N−k−1), for comparison only; it is not a value displayed by this session. There is no fitted noise-scale parameter here. The Gaussian normalization is retained, so negative AIC values are expected in these units. A change of torque units shifts every absolute AIC equally; within-dataset differences are unchanged.

The expected ΔAIC values, measured above the best candidate, are 12.783742, 11.334563, 0, and 1.995941 in table order. Freeing the phase improves χ² by only 0.004059, while adding a parameter costs approximately two AIC units. Thus the fixed-phase candidate ranks first, but the free-phase candidate has nearly comparable support within this candidate set.

Three AICc entries round to the paper's values. The free-phase entry does not: its printed −582.1 instead matches our ordinary AIC. This is an unresolved reporting/calculation discrepancy, not a reason to alter Data Tool's formula or the observations.

The exponential fit also illustrates a parameter discrepancy: our pivoted fit gives m ≈ 448.49 mm⁻¹ rather than the manuscript's 366.1 mm⁻¹, while χ² rounds to its reported 82.1. Its parameter estimates should not be labeled reproduced. The numerical regression checks the independently optimized public-data calculation, not the rounded literature parameter values.

## Interpretation limits

The paper states that the fixed phase was chosen after inspecting the data and that the oscillation has multiple minima. This session flags selection after inspection for all comparisons. AIC's ordinary parameter penalty does not account for every choice made while searching phases, frequencies or model families. The residuals may also contain experimental systematics or correlations. These rankings compare the specified curves under the stated likelihood; they do not establish a modification of Newtonian gravity.

The example does not attempt to reproduce the paper's WAIC, posterior parameter intervals or Bayes factors. Those require posterior calculations and explicit priors beyond this least-squares comparison.

Numerical checks: `tests/fit/eotwashComparison.test.ts`. CSV/session preservation is also checked by `tests/fit/publishedSessions.test.ts`.
