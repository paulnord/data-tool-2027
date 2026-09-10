"""Independent local nonlinear solution/covariance, SciPy 1.16.3."""
import json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.stats import binom
x=9*(np.arange(61)/60)**1.17
rng=np.random.default_rng(7192027)
y=1+2*np.sin(2*np.pi*x/3)+0.75*np.cos(2*np.pi*x/3)+0.05*rng.normal(size=len(x))
def f(v):
 b,s,c,T=v
 return (b+s*np.sin(2*np.pi*x/T)+c*np.cos(2*np.pi*x/T)-y)/0.05
def jac(v):
 b,s,c,T=v
 phase=2*np.pi*x/T
 return np.array([np.ones(len(x)),np.sin(phase),np.cos(phase),2*np.pi*x/T**2*(c*np.sin(phase)-s*np.cos(phase))]).T/0.05
sol=least_squares(f,[0.8,1.8,0.6,3.05],jac=jac,xtol=1e-14,ftol=1e-14,gtol=1e-14)
_,r=np.linalg.qr(jac(sol.x)); inv=np.linalg.solve(r,np.eye(4));cov=inv@inv.T
Path('tests/fit/sine-reference.json').write_text(json.dumps(dict(source='SciPy 1.16.3 least_squares, analytic Jacobian; numpy PCG64 seed 7192027',x=x.tolist(),y=y.tolist(),coefficients=sol.x.tolist(),covariance=cov.tolist(),sse=float(np.sum(f(sol.x)**2)*0.05**2),coverageBounds=[int(binom.ppf(0.00005,1000,.95)),int(binom.ppf(.99995,1000,.95))]),indent=2)+'\n')
