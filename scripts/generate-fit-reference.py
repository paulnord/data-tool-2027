"""Independent SciPy 1.16.3 reference; rerun only when reviewing the test manifest.
No production TypeScript solver/probability code is used here.
"""
import json
from pathlib import Path
import numpy as np
from scipy import linalg, stats
import scipy
M = 10000
scenarios = []
gates = []
for index in range(6):
    n = 8 if index == 5 else 61
    x = np.arange(n)/(n-1) * (1 if index == 5 else 2)
    if index in (2, 3, 4): x = 2*(np.arange(n)/(n-1))**1.3
    truth = np.array([1,2] if index == 5 else [2,10,-9.81], dtype=float)
    sigma = np.full(n, .1 if index == 5 else .02)
    if index == 2: sigma = .01+.02*x/2
    fixed = index in (3,4)
    known = index in (0,2,3)
    free = list(range(1 if fixed else 0, len(truth)))
    design = np.column_stack([x**0,x] + ([] if index == 5 else [x*x/2]))
    a = design[:, free]/sigma[:, None]
    q, r = linalg.qr(a, mode='economic')
    inv = linalg.solve_triangular(r, np.eye(len(free)))
    cov = inv @ inv.T
    df = n-len(free)
    name = ['known-uniform','unknown-uniform','known-heteroscedastic','known-fixed','unknown-fixed','small-line'][index]
    for j in free:
        for metric in ('bias','variance','coverage'): gates.append(f'{name}/{j}/{metric}')
    if known: gates.extend([f'{name}/objective', f'{name}/q-count'])
    else: gates.append(f'{name}/mean-reported-covariance-scale')
    scenarios.append(dict(name=name, x=x.tolist(), truth=truth.tolist(), sigma=sigma.tolist(), free=free, known=known, fixed=fixed, df=df, covariance=cov.tolist(), seedBase=72027000+index*100000, model='line' if index==5 else 'constant-acceleration'))
# Additional mismatch and AR(1) ensemble gates registered before any production runs.
gates.append('wrong-model/objective')
for j in range(3): gates.append(f'ar1/{j}/variance')
# Pointwise mean-curve coverage gates, registered before running the new tests.
for noise in ('known','estimated'):
    for x in (0,2,6): gates.append(f'mean-band/{noise}/{x}/coverage')
alpha=.001/len(gates)
def interval(dist):return [float(dist.ppf(alpha/2)),float(dist.ppf(1-alpha/2))]
for s in scenarios:
    s['objectiveBounds'] = interval(stats.chi2(M*s['df']))
    s['reportedScaleBounds'] = [v/(M*s['df']) for v in s['objectiveBounds']]
# Line projection of the noise-free quadratic, common sigma .02.
x=np.array(scenarios[0]['x']); signal=2+10*x-4.905*x*x
line=np.column_stack([x**0,x]); projected=line @ linalg.lstsq(line, signal)[0]
lam=float(np.sum(((signal-projected)/.02)**2));df=len(x)-2
# Actual unweighted quadratic estimator under stationary AR(1) errors.
a=np.column_stack([x**0,x,x*x/2]); b=linalg.lstsq(a,np.eye(len(x)))[0]
sigma_matrix=.02**2 * .7**np.abs(np.arange(len(x))[:,None]-np.arange(len(x))[None,:])
ar_cov=b@sigma_matrix@b.T
output=dict(source=f'SciPy {scipy.__version__}; Householder QR triangular solves and scipy.stats quantiles', M=M, alphaFamily=.001, gates=gates, alphaGate=alpha, biasLimit=float(stats.norm.ppf(1-alpha/2)), varianceBounds=interval(stats.chi2(M-1)), coverageBounds=interval(stats.binom(M,.95)), qCountBounds=interval(stats.binom(M,.05)), scenarios=scenarios, mismatch=dict(noncentrality=lam,objectiveBounds=interval(stats.ncx2(M*df,M*lam))), arCovariance=ar_cov.tolist())
Path('tests/fit/reference.json').write_text(json.dumps(output,indent=2)+'\n')
