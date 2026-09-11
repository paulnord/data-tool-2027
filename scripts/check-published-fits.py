"""Independent audit of supplied CSV fits. Requires NumPy and SciPy.

Run from any directory with a Python environment containing these packages.
Does not modify inputs or golden results. Numerical targets use absolute sigma.
"""
import json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares

ROOT = Path(__file__).resolve().parents[1]
fixtures = json.loads((ROOT / 'tests/fit/published-reference.json').read_text())['fits']
for f in fixtures:
    lines = [line for line in (ROOT / 'examples/data' / f['file']).read_text().splitlines()
             if line.strip() and not line.startswith('#')]
    rows = np.loadtxt(lines[1:], delimiter=',')
    x, y, sigma = rows[:, f['xColumn']], rows[:, 1], rows[:, f['sigmaColumn']]
    keep = (x >= f.get('minX', -np.inf)) & (x <= f.get('maxX', np.inf))
    x, y, sigma = x[keep], y[keep], sigma[keep]
    initial = np.array(f['startingValues'], dtype=float)
    free = [i for i in range(len(initial)) if i not in f['fixed']]

    def predict(p):
        expr = f['expression']
        if expr == 'a+b*x':
            return p[0] + p[1] * x
        if expr == 'C+A*exp(-x/tau)':
            return p[0] + p[1] * np.exp(-x / p[2])
        if expr == 'A*exp(-x/tau)':
            return p[0] * np.exp(-x / p[1])
        if expr == 'A*exp(-k*x)':
            return p[0] * np.exp(-p[1] * x)
        if expr == 'C+A*((x-t0)/100)^(-5/3)':
            return p[0] + p[1] * ((x-p[2])/100)**(-5/3)
        if expr == 'A*((x-t0)/100)^(-5/3)':
            return p[0] * ((x-p[1])/100)**(-5/3)
        if expr == 'A*((x-t0)/100)^p':
            return p[0] * ((x-p[1])/100)**p[2]
        if expr == 'IP-R/(x-d-a/(x-d)^2)^2':
            return p[0] - p[1] / (x-p[2]-p[3]/(x-p[2])**2)**2
        if expr == 'A*(x/Ts-1)^(-g)':
            return p[0] * (x/p[1]-1)**(-p[2])
        raise ValueError(expr)

    def residual(values):
        params = initial.astype(values.dtype)
        params[free] = values
        return (predict(params)-y)/sigma

    result = least_squares(residual, initial[free], jac='cs', x_scale='jac',
                           ftol=1e-13, xtol=1e-13, gtol=1e-10, max_nfev=10000)
    assert result.success, f['id']
    params = initial.copy()
    params[free] = result.x
    _, singular, v = np.linalg.svd(result.jac, full_matrices=False)
    errors = np.sqrt(np.diag((v.T/singular**2) @ v))
    chi = float(result.fun @ result.fun / (len(x)-len(free)))
    expected = f['expected']
    np.testing.assert_allclose(params, expected['coefficients'], rtol=2e-6, atol=2e-6)
    np.testing.assert_allclose(errors, expected['standardErrors'], rtol=2e-4, atol=2e-10)
    np.testing.assert_allclose(chi, expected['reducedChiSquare'], rtol=1e-7, atol=1e-9)
    print(f"{f['id']}: n={len(x)}, coefficients={params}, standard errors={errors}, reduced chi-square={chi:.10g}")

# Optional cross-check of the paper's method, which Data Tool does not implement.
# SciPy 1.18.1 still provides scipy.odr; it is scheduled for removal in 1.19.
import sys
if '--odr' in sys.argv:
    from scipy import odr
    lines = [line for line in (ROOT / 'examples/data/published-pulsar-photon-index-vs-temperature.csv').read_text().splitlines()
             if line.strip() and not line.startswith('#')]
    rows = np.loadtxt(lines[1:], delimiter=',')
    x, y, sx, sy = rows[:, :4].T
    result = odr.ODR(odr.RealData(x, y, sx=sx, sy=sy),
                     odr.Model(lambda p, x: p[0]+p[1]*x), beta0=[4.32, -1.23]).run()
    np.testing.assert_allclose(result.beta, [4.31851393, -1.22574237], rtol=1e-5)
    np.testing.assert_allclose(result.sd_beta, [0.66348896, 0.31344871], rtol=1e-5)
    np.testing.assert_allclose(result.res_var, 9.56841186, rtol=1e-5)
    print(f'photon ODR: coefficients={result.beta}, rescaled standard errors={result.sd_beta}, reduced objective={result.res_var}')
