# HATS-18 transit timing: model comparison and later observations

[Openable session](hats18-model-comparison.trksess) · [CSV data](hats18-model-comparison.csv)

The session contains **34 measured transit times**: the 32 observations compiled by Southworth et al. (2022), followed by two new observations from May 2024 reported by Kutluay et al. (2026). The first 32 are selected; the two later observations are unchecked in all three candidate models. Open the session, choose **Use these data**, then **Refit and compare**. Select the last two rows under **Observations & exclusions** to include them in a subsequent fit.

Status: **Comparison**. The original-sample AIC and BIC values agree with the 2022 paper at its printed precision after aligning likelihood conventions. The reduced chi-square and parameter-uncertainty conventions differ as explained below. This example does not reproduce the larger 2026 analysis.

## Complete references

[S2022] Southworth, John; Barker, A. J.; Hinse, T. C.; Jongen, Y.; Dominik, M.; Jørgensen, U. G.; Longa-Peña, P.; Sajadian, S.; Snodgrass, C.; Tregloan-Reed, J.; Bach-Møller, N.; Bonavita, M.; Bozza, V.; Burgdorf, M. J.; Jaimes, R. Figuera; Helling, Ch.; Hitchcock, J. A.; Hundertmark, M.; Khalouei, E.; Korhonen, H.; Mancini, L.; Peixinho, N.; Rahvar, S.; Rabus, M.; Skottfelt, J.; Spyratos, P. (2022). A search for transit timing variations in the HATS-18 planetary system. Monthly Notices of the Royal Astronomical Society, 515(3), 3212. DOI: 10.1093/mnras/stac1931. https://doi.org/10.1093/mnras/stac1931 . Data: Table 3; model comparison: Table 4; reference ephemeris: section 4.3. Exact manuscript used: https://arxiv.org/abs/2207.05873v1 .

[K2026] Kutluay, A. C.; Baştürk, Ö.; Barker, Adrian J.; Yalçınkaya, S.; Southworth, J.; Selam, S. O.; Şimşir, Ö.; Kaplan, K.; Akar, F.; Ertürk, İ. A.; Zengin, Z.; Akalın, E.; Özsoy, V.; Yaldır, Ö.; İçöz, D.; Mancini, L.; Duru, B.; Tezcan, F.; Özfidan, A.; Umar, U.; Wünsche, A.; Burgdorf, M. J.; Cannon, R. E.; Jaimes, R. J. Figuera; Hinse, T. C.; Okoth, V.; Reed, J. T.; Buğday, E. S.; Akdere, U.; Turan, Y.; Aliş, S.; Tezcan, C. T.; Yelkenci, F. K.; Hajarat, S. (2026). Chasing the Tides: Searching for Orbital Decay Signatures in Transit Timing Data and Tidal Models for 20 Hot Jupiters. arXiv:2602.01446v1, submitted 1 February 2026 (manuscript reports accepted for publication in Publications of the Astronomical Society of the Pacific). DOI: 10.48550/arXiv.2602.01446. https://doi.org/10.48550/arXiv.2602.01446 . Data: Table 3; observing dates/instrument: Table 2 and section III.1.5. Exact manuscript used: https://arxiv.org/html/2602.01446v1 .

## What each source contributes

- **S2022:** every row of Table 3, in the original order, including its nonchronological rows. The table combines 18 Danish Telescope timings, nine Jongen Telescope timings, two effective TESS sector timings, two previously published Patra et al. (2020) timings, and one transit from Penev et al. (2016) reanalysed by Southworth's team. These are fitted transit midpoints with uncertainties, not raw stellar-brightness measurements. Original telescope/source descriptions remain in the data table.
- **K2026:** the two HATS-18 rows explicitly printed in Table 3. Table 2 identifies observations on 2024-05-08 and 2024-05-29 with the remotely operated 50 cm CDK20 telescope at El Sauce Observatory, Chile. The 2026 publication also analyses earlier observations and TESS data. Those are not appended because this example preserves the original sample and avoids counting reanalysed observations twice.

| Observation date |      BJD(TDB) | Quoted sigma (days) | Cycle E | O-C (seconds) | Sigma (seconds) | Default selection |
| ---------------- | ------------: | ------------------: | ------: | ------------: | --------------: | ----------------- |
| 2024-05-08       | 2460439.60668 |             0.00082 |    2164 |    123.424128 |          70.848 | Unchecked         |
| 2024-05-29       | 2460460.55349 |             0.00086 |    2189 |    185.156928 |          74.304 | Unchecked         |

Both publications use **BJD(TDB)**. Do not mix these with HJD or UTC timestamps without conversion. The original published time and uncertainty tokens are preserved in the CSV and the session's source table. The two references are also embedded in both files, so provenance remains available independently of this page.

## Coordinates and models

The plot uses `x = E/1000` and `y = 86400 * (T - 2458626.511225 - 0.83784382*E)` seconds. The reference ephemeris is from S2022 section 4.3. Decimal arithmetic was used to transform the printed times; uncertainties are multiplied by 86400. The new integer cycle numbers are the nearest integers to `(T - 2458626.511225)/0.83784382`.

Subtracting this fixed reference line makes timing deviations visible. It does not remove free parameters from the comparison. The linear candidate retains a free intercept and slope (constant orbital period); the quadratic adds a period-change term; the cubic adds a further change in the period evolution. There are respectively 2, 3, and 4 free parameters. Initial parameter values come from the original 32-point fits and are all editable. Fit results are recalculated, not cached.

The CSV's final columns identify the reference and the default session selection. The selection column is descriptive: importing the CSV alone does not restore comparison candidates or exclusions. Open the `.trksess` for the configured example.

## Numerical comparison with the original 32 observations

| Model     | Chi-square | NDF | Chi-square/NDF | Paper-convention AIC | Paper-convention BIC | Data Tool AIC | Delta AIC |
| --------- | ---------: | --: | -------------: | -------------------: | -------------------: | ------------: | --------: |
| Linear    |  57.295013 |  30 |       1.909834 |            61.295013 |            64.226485 |    340.000946 |         0 |
| Quadratic |  57.101862 |  29 |       1.969030 |            63.101862 |            67.499070 |    341.807795 |  1.806849 |
| Cubic     |  54.870722 |  28 |       1.959669 |            62.870722 |            68.733666 |    341.576656 |  1.575709 |

The paper-convention values round to all six AIC/BIC entries in S2022 Table 4. That convention uses `chi2 + 2*k` and `chi2 + k*ln(n)`. Data Tool retains the Gaussian normalization term `sum(ln(2*pi*sigma_i^2))`; in the session's seconds units, it adds approximately 278.705933 to every AIC/BIC. Differences, rankings and Akaike weights agree. Absolute information criteria should not be compared across different selected datasets.

S2022 reports linear reduced chi-square 1.79. The tabulated observations give `57.295013/30 = 1.909834`; dividing by 32 instead gives 1.790469, suggesting an n rather than n-k denominator in that reported value. S2022 also inflates ephemeris parameter uncertainties; this example retains the absolute supplied uncertainty scale. These differences are documented rather than adjusted away.

## Later observations and assumptions

With the two newer observations unchecked, all fitted coefficients and comparison statistics remain those of the original 32-point sample. Their displayed uncertainties still describe the measurements. Selecting the two points changes the fitted sample to 34 and refits all three candidates. Comparing frozen predictions against later observations is a different exercise from selecting them and refitting; predictive uncertainty must include parameter covariance as well as new measurement uncertainty.

Gaussian independence and model adequacy remain unknown in the session; conditional inference is enabled to make the comparison available. The modest AIC preference for the line does not prove a constant period. A polynomial extrapolation is not a complete physical orbital model. This example preserves the quoted uncertainty scale and does not add correlations or inflate errors to force a reduced chi-square of one.
