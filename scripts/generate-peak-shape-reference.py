"""Independent SciPy reference: Brent mode root, central differences, SVD covariance."""
from pathlib import Path
import json
import numpy as np
from scipy.integrate import quad
from scipy.optimize import brentq, least_squares

def mode(e, d):
    if e == 0:
        return 0.0
    def slope(t):
        u = d*t-e
        return d*(np.tanh(u)-np.sinh(u)*np.cosh(u))-np.tanh(t)
    return np.sinh(brentq(slope, min(0, e/d), max(0, e/d), xtol=1e-14))

def profile(x, p):
    b, a, mu, w, e, d = p
    zm = mode(e, d)
    z = (x-mu)/w+zm
    def h(z):
        u = d*np.arcsinh(z)-e
        return np.cosh(u)/np.sqrt(1+z*z)*np.exp(-.5*np.sinh(u)**2)
    return b+a*h(z)/h(zm)

def moments(e, d):
    transform = lambda z: np.sinh((np.arcsinh(z)+e)/d)
    phi = lambda z: np.exp(-z*z/2)/np.sqrt(2*np.pi)
    mean = quad(lambda z: transform(z)*phi(z), -16, 16, epsabs=1e-12)[0]
    central = [quad(lambda z: (transform(z)-mean)**k*phi(z), -16, 16, epsabs=1e-12)[0] for k in [2,3,4]]
    return [central[1]/central[0]**1.5, central[2]/central[0]**2-3]

cases = []
for name, e, d, fixed in [("both", .6, .8, []), ("skew", -.5, 1, [5]), ("tail", 0, 1.4, [4])]:
    truth = np.array([.7, 3.0, .3, 1.2, e, d])
    x = np.linspace(-6, 7, 131)
    y = profile(x, truth)+.01*np.sin(np.arange(len(x))*1.7)
    start = np.array([.5, 2.7, .1, 1., e*.6, 1+(d-1)*.6])
    start[fixed] = truth[fixed]
    free = [i for i in range(6) if i not in fixed]
    def full(q):
        p = start.copy(); p[free] = q; return p
    result = least_squares(lambda q: (profile(x, full(q))-y)/.05, start[free], jac="3-point", diff_step=1e-5,
                           bounds=([1e-6 if i in [3,5] else -np.inf for i in free], np.inf), xtol=1e-13, ftol=1e-13, gtol=1e-13)
    _, s, vt = np.linalg.svd(result.jac, full_matrices=False)
    covariance = np.zeros((6,6)); covariance[np.ix_(free,free)] = (vt.T/s**2)@vt
    fitted = full(result.x)
    moment_jac = np.zeros((2,6))
    for index in [4,5]:
        if index in fixed:
            continue
        a, b = fitted.copy(), fitted.copy()
        a[index] += 1e-4; b[index] -= 1e-4
        moment_jac[:,index] = (np.array(moments(a[4],a[5]))-np.array(moments(b[4],b[5])))/2e-4
    cases.append(dict(name=name, x=x.tolist(), y=y.tolist(), sigma=.05, start=start.tolist(), fixed=fixed,
                      fitted=fitted.tolist(), covariance=covariance.tolist(), moments=moments(fitted[4],fitted[5]),
                      momentErrors=np.sqrt(np.diag(moment_jac@covariance@moment_jac.T)).tolist(), chiSquared=float(result.fun@result.fun)))
target = Path(__file__).resolve().parents[1]/"tests/fit/peak-shape-reference.json"
target.write_text(json.dumps(dict(method="SciPy least_squares, Brent mode, 3-point Jacobian, SVD covariance; adaptive quadrature moments", cases=cases), indent=2)+"\n")
