# Published datasets: fits and comparison notes

These examples connect ordinary CSV files with published measurements and explicitly documented calculations. Each page identifies the data, column choices, fit range, equation, starting values, fixed parameters, reproduced results and limits of comparison with the publication. Each CSV has a configured `.trksess` companion with the same base name. The files accompany the downloadable example archive and desktop Examples directory.

| Dataset | Review result | Documentation |
| --- | --- | --- |
| ASASSN-14li radio | Close to published parameters; statistics and error conventions differ | [Radio](asassn14li-radio.md) |
| ASASSN-14li X-ray | Published fit values not reproduced; cause unresolved | [X-ray](asassn14li-xray.md) |
| Chromium Rydberg series | Close with precise fixed R; solver sensitivity remains | [Chromium](cri-rydberg.md) |
| BESIII p pbar pi0 continuum | Clean reproduction of published nonlinear power-law parameters, errors and chi-square | [BESIII continuum](besiii-ppbarpi0-continuum.md) |
| YMnO3 Z-mode spin precession | Published raw trace; damped-sine fit recovers period, phase and near-30 K relaxation time | [YMnO3 precession](ymno3-spin-precession.md) |
| DyFeO3 coherent spin wave | Published raw reflection trace; late-time damped fit gives 221 GHz and lifetime consistent with the paper's ~85 ps comparison | [DyFeO3 spin wave](dyfeo3-spin-wave.md) |
| PWN luminosity / spin-down power | Close using explicit symmetric log errors | [PWN / spin-down](pwn-luminosity-vs-edot.md) |
| PWN luminosity / light-cylinder field | Close using explicit symmetric log errors | [PWN / field](pwn-luminosity-vs-blc.md) |
| Pulsar luminosity / spin-down power | Published statistic not reproduced | [Pulsar / spin-down](pulsar-luminosity-vs-edot.md) |
| Pulsar luminosity / light-cylinder field | Published fit and statistic differ | [Pulsar / field](pulsar-luminosity-vs-blc.md) |
| Ion chamber, thin walls | Coefficients reproduced closely; fit and evaluation rows differ | [Thin walls](ion-chamber-wall-thin.md) |
| Ion chamber, thick walls | Coefficients reproduced closely; fit and evaluation rows differ | [Thick walls](ion-chamber-wall-thick.md) |
| Ba-137m decay | Single trace is not the published ensemble | [Decay](ba137m-decay.md) |
| Supercooled water | Smoothed values recover the smoothing curve; original-data statistic is not comparable | [Water](supercooled-water-viscosity.md) |

## What “fitted results differ from publication” means

It means that the calculation documented here does not reproduce every quoted parameter, uncertainty or statistic. It does not mean that the publication is wrong. Some differences have identified causes, such as selecting different rows for fitting and evaluation, comparing one run with an ensemble, or fitting smoothed values. Others remain unresolved.

A printed table often has fewer significant figures than the measurements used for fitting. Rounding in observations, coordinates or uncertainties can affect a fit, particularly through the weights. Small differences can therefore be compatible with tabulation precision. We have not performed a rounding-sensitivity study that establishes whether rounding explains the unresolved X-ray or pulsar discrepancies. Agreement between two optimizers supports the calculation for the stated input and objective; it does not prove that their objective matches the authors' procedure.

To resolve an unexplained discrepancy, compare the exact equations, units, reference time, selected rows, treatment of asymmetric errors, covariance, fixed constants and uncertainty scaling. Preserve the published observations while investigating. A future rounding study should perturb tabulated values within their last-digit intervals and distinguish plausible variation from a proven bound.

## Statistical conventions

Unless a page explicitly says otherwise, the reproduced calculation minimizes sum((y−model(x))/sigma_y)² with independent supplied Y standard deviations. X is held fixed. Reduced chi-square is that sum divided by the number of selected observations minus the number of free parameters. Excluded observations do not contribute to Data Tool's fit statistic.

The YMnO3 and DyFeO3 time-domain source files do not provide pointwise standard uncertainties. Their configured sessions instead use equal unknown scatter estimated from residuals; parameter errors are therefore conditional equal-scatter estimates rather than propagated published per-point errors.

The tabulated standard errors retain the absolute supplied uncertainty scale. Some external routines instead multiply covariance by reduced chi-square, multiplying standard errors by its square root. Those are different conventions, not automatically conflicting calculations. Nonlinear standard errors are local approximations. Common systematic errors, shared background subtraction and correlations are not automatically estimated by a diagonal-error fit. Large reduced chi-square can indicate model inadequacy, underestimated uncertainties or unaccounted correlations; very small values can reflect smoothing or conservative errors.

The luminosity files preserve asymmetric errors and provide a particular symmetric log-space approximation. The pulsar paper cautions about distance uncertainties; the helper weighting is not claimed to be the exact published procedure. Changing logarithmic axis display does not change a fit's coordinates or error model.

## Review and regression checks

The original reviewed inputs came from PR #1 (`63d44456ac56ac7b2ef4f25398d725cb0849e3d2`) and PR #2 (`2e413a201fcd2709147667a85ba564dae4cab263`). Numerical rows are preserved. Header corrections clarify the chromium constant, the Ba-137m half-life interpretation and the water smoothing statistic. PR #3 adds configured sessions, reorganizes the corpus under this `published/` directory, and adds the BESIII continuum benchmark.

The 17 legacy Data Tool calculations retained in `tests/fit/published-reference.json` are checked against independent SciPy calculations using complex-step Jacobians and SVD covariance. The BESIII example was independently checked against its published two-parameter continuum fit and is also exercised by the configured-session validation test. Source verification is more limited than numerical verification: radio/X-ray and chamber tables were checked in full; selected influential pulsar entries and the water smoothing method were checked; the Ba-137m full table was not accessible during review. We do not claim every file has passed a complete transcription audit.

Developer checks live in `tests/fit/publishedExamples.test.ts`, `tests/fit/publishedSessions.test.ts` and `tests/fit/published-reference.json`; `scripts/check-published-fits.py` independently recalculates the reference fits with NumPy/SciPy. These are numerical regression targets for specified CSV calculations. Literature comparisons remain separately labeled and are not used as exact targets merely because they were published.

Run `python scripts/check-published-fits.py` from a checkout with NumPy/SciPy installed.
