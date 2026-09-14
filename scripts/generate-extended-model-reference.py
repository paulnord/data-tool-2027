"""Independent SciPy/SVD checks for the v4 model additions."""
import json
from pathlib import Path
import numpy as np
import scipy
from scipy.optimize import least_squares

fixtures = []
cases = [
    ("exponential-growth", np.linspace(0, 4, 61), [0.4, 1.5, 2.1], [0, 1, 2.5],
     lambda x, p: p[0] + p[1] * np.exp(x / p[2]), [2]),
    ("sigmoid", np.linspace(-4, 6, 81), [0.4, 3, 0.7, 0.9], [0, 2.5, 0, 1.3],
     lambda x, p: p[0] + p[1] / (1 + np.exp(-(x - p[2]) / p[3])), [3]),
]
for degree in range(5, 11):
    cases.append((f"polynomial-{degree}", np.linspace(-1, 1, 81),
                  [(-1) ** i / (i + 1) for i in range(degree + 1)],
                  [0] * (degree + 1),
                  lambda x, p: np.polynomial.polynomial.polyval(x, p), []))
for model, x, truth, start, function, positive in cases:
    sigma = 0.04 + 0.02 * (1 + np.cos(np.arange(len(x))))
    y = function(x, truth) + 0.02 * np.sin(np.arange(len(x)) * 1.71)
    fits = []
    for fixed in [[], [0]]:
        free = [i for i in range(len(truth)) if i not in fixed]
        initial = np.array(start, dtype=float)
        initial[fixed] = np.array(truth)[fixed]

        def residual(values):
            p = initial.astype(values.dtype)
            p[free] = values
            return (function(x, p) - y) / sigma

        lower = [1e-12 if i in positive else -np.inf for i in free]
        result = least_squares(residual, initial[free], jac="cs",
                               bounds=(lower, np.inf), xtol=1e-13,
                               ftol=1e-13, gtol=1e-13, max_nfev=10000)
        initial[free] = result.x
        _, singular, vt = np.linalg.svd(result.jac, full_matrices=False)
        covariance = (vt.T / singular**2) @ vt
        fits.append(dict(fixed=fixed, coefficients=initial.tolist(),
                         objective=float(result.fun @ result.fun),
                         covariance=covariance.tolist()))
    fixtures.append(dict(model=model, x=x.tolist(), y=y.tolist(), sigma=sigma.tolist(),
                         truth=truth, start=start, cases=fits))
Path("tests/fit/extended-model-reference.json").write_text(json.dumps(
    dict(scipy=scipy.__version__, method="least_squares with complex-step Jacobian; SVD covariance", fixtures=fixtures),
    indent=2) + "\n")
