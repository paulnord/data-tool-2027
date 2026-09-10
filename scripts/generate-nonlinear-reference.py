"""Independent SciPy least_squares + complex-step Jacobian references; test-only.
Run with .tools/scipy-fit/bin/python scripts/generate-nonlinear-reference.py.
CSV exercises are static outputs; no generator ships with the application.
"""
import csv, json
from pathlib import Path
import numpy as np
import scipy
from scipy.optimize import least_squares
from scipy.stats import binom
models = [
 ('exponential-decay', [0.4,3,2.2], np.linspace(0,8,81), lambda x,p:p[0]+p[1]*np.exp(-x/p[2]), [2], 'Time (s)', 'Signal (V)'),
 ('power-law-free', [0.3,1.2,1.7], np.linspace(.25,4,81), lambda x,p:p[0]+p[1]*x**p[2], [], 'x', 'Signal (V)'),
 ('gaussian', [0.2,3,.4,.8], np.linspace(-4,4,81), lambda x,p:p[0]+p[1]*np.exp(-.5*((x-p[2])/p[3])**2), [3], 'Position (mm)', 'Signal (V)'),
 ('damped-sine', [0.4,2,.5,1.7,4], np.linspace(0,10,121), lambda x,p:p[0]+np.exp(-x/p[4])*(p[1]*np.sin(2*np.pi*x/p[3])+p[2]*np.cos(2*np.pi*x/p[3])), [3,4], 'Time (s)', 'Signal (V)'),
 ('lorentzian', [0.2,3,.4,.6], np.linspace(-4,4,81), lambda x,p:p[0]+p[1]/(1+((x-p[2])/p[3])**2), [3], 'Frequency offset (Hz)', 'Signal (V)'),
]
references=[]
for index,(name,truth,x,fn,positive,xhead,yhead) in enumerate(models):
 rng=np.random.Generator(np.random.PCG64(93000+index))
 sigma=.02*(1+np.arange(len(x))/len(x))
 y=fn(x,truth)+sigma*rng.standard_normal(len(x))
 initial=np.array(truth)*np.array([1.2,.85]+[1.1]*(len(truth)-2))
 cases=[]
 for fixed in [[],[0],[len(truth)-1]]:
  free=[j for j in range(len(truth)) if j not in fixed]
  def full(v):
   p=np.array(truth,dtype=np.result_type(v));p[free]=v;return p
  fun=lambda v:(fn(x,full(v))-y)/sigma
  jac=lambda v:np.column_stack([np.imag(fun(v.astype(complex)+1e-28j*np.eye(len(free))[j]))/1e-28 for j in range(len(free))])
  lower=[1e-10 if j in positive else -np.inf for j in free]
  fit=least_squares(fun,initial[free],jac=jac,bounds=(lower,np.inf),ftol=1e-13,xtol=1e-13,gtol=1e-13,max_nfev=3000)
  assert fit.success,(name,fit.message)
  # Independent SVD, not production QR and not inverse normal equations.
  _,singular,vt=np.linalg.svd(jac(fit.x),full_matrices=False)
  cov=(vt.T/singular**2)@vt
  cases.append(dict(fixed=fixed,coefficients=full(fit.x).tolist(),covariance=cov.tolist(),objective=float(np.sum(fun(fit.x)**2))))
 references.append(dict(model=name,truth=truth,initial=initial.tolist(),x=x.tolist(),y=y.tolist(),mean=fn(x,truth).tolist(),sigma=sigma.tolist(),cases=cases))
 with Path('examples/data',name+'.csv').open('w',newline='') as f:
  f.write('# Synthetic classroom data: '+name+'. Choose the corresponding model and inspect the residuals.\n')
  w=csv.writer(f);w.writerow([xhead,yhead]);w.writerows(zip(x,y))
Path('tests/fit/nonlinear-reference.json').write_text(json.dumps(dict(scipy=scipy.__version__,numpy=np.__version__,generator='PCG64; seeds 93000..93004; complex-step Jacobians and SVD covariance',coverage=dict(trials=500,seed=94000,alpha=0.001,gates=19,lower=int(binom.ppf(0.001/(2*19),500,.95)),upper=int(binom.ppf(1-0.001/(2*19),500,.95))),fixtures=references),indent=2)+'\n')
