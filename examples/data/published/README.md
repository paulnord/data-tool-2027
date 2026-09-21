# Published-data reproduction studies

These examples connect ordinary CSV files with published measurements and documented calculations. The application groups them as **Published studies**; “published” describes the provenance of the observations, not a claim that every Data Tool result reproduces the publication. Each study is assigned one of the five statuses below so that a close comparison, a deliberately different calculation and an unresolved discrepancy are not presented as equivalent validation evidence.

This directory contains 16 studies. Fifteen have a CSV, a configured `.trksess` companion and an individual documentation page. The Eöt-Wash session opens a four-candidate model comparison directly. The photon-index/temperature study has a CSV and documentation but no configured fit session because the publication used a method that Data Tool does not implement. The files accompany the downloadable example archive and desktop Examples directory.

## Reproduction statuses

- **Reproduced:** the documented calculation agrees with the reported parameters, parameter errors and fit statistic within the precision published, after any stated data preparation. This does not imply bit-for-bit agreement with unrounded author data.
- **Close:** the principal fitted values are close, but comparison of errors or statistics depends on a documented convention such as uncertainty scaling, error symmetrization, a fixed constant, or different fit and evaluation rows.
- **Comparison:** the example uses published observations, but its model, fit window, aggregation or data product differs from the publication target. Agreement is informative but is not a reproduction.
- **Not reproduced:** the intended comparison differs materially from the publication and the cause has not been established. Independent agreement on the stated CSV calculation does not resolve that literature discrepancy.
- **Unsupported:** the publication used a fitting method outside Data Tool's current Y-error least-squares model. The data remain useful for inspection, but Data Tool should not be used to claim reproduction of that result.

| Status | Dataset | Review result | Documentation or data |
| --- | --- | --- | --- |
| Comparison | Eöt-Wash residual torques | Four-model comparison; three published AICc entries agree after applying the paper's correction, with documented free-phase and exponential-parameter discrepancies | [Gravity comparison](eotwash-model-comparison.md) |
| Reproduced | BESIII p pbar pi0 continuum | Nonlinear power-law parameters, errors and chi-square agree within published precision | [BESIII continuum](besiii-ppbarpi0-continuum.md) |
| Close | ASASSN-14li radio | Parameters are close; statistics and standard-error scaling conventions differ slightly | [Radio](asassn14li-radio.md) |
| Close | Chromium Rydberg series | Parameters and statistic are close with the precise fixed Rydberg constant; common systematic error remains separate | [Chromium](cri-rydberg.md) |
| Close | PWN luminosity / spin-down power | Slope and statistic are close using the documented symmetric log-error helper | [PWN / spin-down](pwn-luminosity-vs-edot.md) |
| Close | PWN luminosity / light-cylinder field | Slope and statistic are close using the documented symmetric log-error helper | [PWN / field](pwn-luminosity-vs-blc.md) |
| Close | Ion chamber, thin walls | Coefficients are reproduced closely; the paper's statistic evaluates more rows than were fitted | [Thin walls](ion-chamber-wall-thin.md) |
| Close | Ion chamber, thick walls | Coefficients are reproduced closely; the paper's statistic evaluates more rows than were fitted | [Thick walls](ion-chamber-wall-thick.md) |
| Comparison | YMnO3 Z-mode spin precession | A late-time, simplified damped-sine fit recovers the reported period, phase and near-30 K relaxation-time scale | [YMnO3 precession](ymno3-spin-precession.md) |
| Comparison | DyFeO3 coherent spin wave | A late-time fit gives 221 GHz and a lifetime consistent with a separate approximately 85 ps result; the exact trace and window are not established as identical | [DyFeO3 spin wave](dyfeo3-spin-wave.md) |
| Comparison | Ba-137m decay | The complete published representative trace is one run; the four other run-level datasets behind the five-run result are not published | [Decay](ba137m-decay.md) |
| Comparison | Supercooled water | Rounded smoothed values recover the smoothing curve; the original-measurement statistic is not comparable | [Water](supercooled-water-viscosity.md) |
| Not reproduced | ASASSN-14li X-ray | The 95 printed rows do not reproduce Table 1; three earlier Swift observations omitted from the fit table are a strong, reduction-sensitive explanation | [X-ray](asassn14li-xray.md) |
| Not reproduced | Pulsar luminosity / spin-down power | The published statistic is not reproduced with the documented symmetric log-error helper | [Pulsar / spin-down](pulsar-luminosity-vs-edot.md) |
| Not reproduced | Pulsar luminosity / light-cylinder field | The published slope and statistic differ with the documented symmetric log-error helper | [Pulsar / field](pulsar-luminosity-vs-blc.md) |
| Unsupported | Pulsar photon index / surface temperature | The paper used orthogonal-distance regression with uncertainties in both coordinates; Data Tool fits Y errors with X held fixed | [Photon index / temperature](pulsar-photon-index-vs-temperature.md) |

## What “fitted results differ from publication” means

It means that the calculation documented here does not reproduce every quoted parameter, uncertainty or statistic. It does not mean that the publication is wrong or that Data Tool's optimizer failed. Some differences have identified causes, such as selecting different rows for fitting and evaluation, comparing one run with an ensemble, fitting smoothed values, or using a different statistical method. Others remain unresolved.

A printed table often has fewer significant figures than the measurements used for fitting. Rounding in observations, coordinates or uncertainties can affect a fit, particularly through the weights. Small differences can therefore be compatible with tabulation precision. The X-ray discrepancy has a strong incomplete-table explanation documented on its page; the pulsar weighting remains a hypothesis. Agreement between two optimizers supports the calculation for the stated input and objective; it does not prove that their inputs and objective match the authors' procedure.

To resolve an unexplained discrepancy, compare the exact equations, units, reference time, selected rows, treatment of asymmetric errors, covariance, fixed constants and uncertainty scaling. Preserve the published observations while investigating. A future rounding study should perturb tabulated values within their last-digit intervals and distinguish plausible variation from a proven bound.

## Statistical conventions

Unless a page explicitly says otherwise, the reproduced calculation minimizes sum((y−model(x))/sigma_y)² with independent supplied Y standard deviations. X is held fixed. Reduced chi-square is that sum divided by the number of selected observations minus the number of free parameters. Excluded observations do not contribute to Data Tool's fit statistic.

The YMnO3 and DyFeO3 time-domain source files do not provide pointwise standard uncertainties. Their configured sessions instead use equal unknown scatter estimated from residuals; parameter errors are therefore conditional equal-scatter estimates rather than propagated published per-point errors.

The tabulated standard errors retain the absolute supplied uncertainty scale. Some external routines instead multiply covariance by reduced chi-square, multiplying standard errors by its square root. Those are different conventions, not automatically conflicting calculations. Nonlinear standard errors are local approximations. Common systematic errors, shared background subtraction and correlations are not automatically estimated by a diagonal-error fit. Large reduced chi-square can indicate model inadequacy, underestimated uncertainties or unaccounted correlations; very small values can reflect smoothing or conservative errors.

The luminosity files preserve asymmetric errors and provide a particular symmetric log-space approximation. All 35 source rows used by the pulsar and PWN luminosity files were checked against the publication tables. The paper also adopts a 40% distance uncertainty, and applying the corresponding luminosity-error floor moves the pulsar fits substantially closer to the published results. That is a useful hypothesis about the weighting difference, not proof of the authors' exact implementation, so the two pulsar studies remain labeled **Not reproduced**. Changing logarithmic axis display does not change a fit's coordinates or error model.

## Independent-solver checks and literature reproduction

The 18 Data Tool calculations retained in `tests/fit/published-reference.json` are checked against independent SciPy calculations using complex-step Jacobians and SVD covariance. Those checks answer a narrow software question: given the same CSV rows, equation, fixed parameters, selection and Y-error objective, does Data Tool obtain the independently calculated result? They do **not** establish that the inputs and objective reconstruct the publication. The reproduction status table above answers that separate literature-comparison question.

The BESIII example was also checked directly against its published two-parameter continuum fit and is exercised by the configured-session validation test. Source verification is more limited than numerical verification: radio/X-ray, chamber, the Ba-137m representative trace and all 35 luminosity-source rows were checked against the published tables; the water smoothing method was checked. The four additional Ba-137m runs are not published as a dataset. We do not claim every file has passed a complete transcription audit. The photon-index/temperature ODR result is not a Data Tool numerical regression target because its method is unsupported.

Developer checks live in `tests/fit/publishedExamples.test.ts`, `tests/fit/publishedSessions.test.ts` and `tests/fit/published-reference.json`; `scripts/check-published-fits.py` independently recalculates the supported reference fits with NumPy/SciPy. Literature values are not used as exact regression targets merely because they were published.

Run `python scripts/check-published-fits.py` from a checkout with NumPy/SciPy installed.
