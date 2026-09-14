import { normalQuadratureRules } from "./normalQuadrature";

export const pythonPeakModelHelpers = `
def peak_mode(skew, tail):
    # Strictly decreasing log-density derivative; one root in this bracket.
    lo, hi = sorted((0.0, skew/tail))
    for _ in range(64):
        t = lo/2 + hi/2
        u = tail*t-skew
        if tail*(np.tanh(u)-np.sinh(u)*np.cosh(u))-np.tanh(t) > 0:
            lo = t
        else:
            hi = t
    return np.sinh(lo/2 + hi/2)

def gaussian_peak(x, p):
    b, amplitude, mu, width, skew, tail = p
    if not (width > 0 and tail > 0):
        return np.full_like(x, np.nan, dtype=float)
    offset = (x-mu)/width
    if skew == 0 and tail == 1:
        return b + amplitude*np.exp(-0.5*offset**2)
    zm = peak_mode(skew, tail)
    def log_shape(z):
        u = tail*np.arcsinh(z)-skew
        return np.logaddexp(u, -u)-np.log(2)-0.5*np.sinh(u)**2-np.log(np.hypot(1, z))
    with np.errstate(over="ignore", invalid="ignore"):
        return b + amplitude*np.exp(log_shape(offset+zm)-log_shape(zm))
`;

export const pythonPeakShapeHelpers = `${pythonPeakModelHelpers}
def peak_moments(skew, tail):
    from scipy.special import roots_hermitenorm
    if not (np.isfinite(skew) and np.isfinite(tail) and tail > 0):
        return None
    if skew == 0 and tail == 1:
        return np.zeros(2)
    estimates = []
    for order in (128, 256):
        z, weights = roots_hermitenorm(order)
        weights = weights/np.sqrt(2*np.pi)
        with np.errstate(over="ignore", invalid="ignore", divide="ignore"):
            values = np.sinh((np.arcsinh(z)+skew)/tail)
            scale = np.max(np.abs(values))
            if not (np.isfinite(scale) and scale > 0):
                return None
            values = values/scale
            centered = values-np.dot(weights, values)
            variance = np.dot(weights, centered**2)
            estimates.append(np.array([0 if skew == 0 else np.dot(weights, centered**3)/variance**1.5,
                                       np.dot(weights, centered**4)/variance**2-3]))
    if not np.all(np.isfinite(estimates)) or np.any(np.abs(estimates[0]-estimates[1]) > 1e-8*(1+np.abs(estimates[1]))):
        return None
    return estimates[1]

def report_peak_moments(fitted, covariance, free_index, uncertainty_reason):
    moments = peak_moments(fitted[4], fitted[5]) if fitted[1] != 0 else None
    if moments is None:
        print("Peak moments unavailable: zero height or unresolved numerical integration")
        return
    gradients = np.zeros((2, 6))
    for index in (4, 5):
        if index not in free_index:
            continue
        step = 1e-4*max(1, abs(fitted[index]))
        if index == 5:
            step = min(step, fitted[index]/100)
        a, b = fitted.copy(), fitted.copy()
        a[index] += step
        b[index] -= step
        high, low = peak_moments(a[4], a[5]), peak_moments(b[4], b[5])
        gradients[:, index] = (high-low)/(2*step) if high is not None and low is not None else np.nan
    for i, label in enumerate(("Peak skewness", "Peak excess kurtosis (Gaussian = 0)")):
        gradient = gradients[i]
        if i == 1 and fitted[4] == 0:
            gradient[4] = 0
        variance = gradient @ covariance @ gradient
        fixed = 4 not in free_index and ((i == 0 and fitted[4] == 0) or 5 not in free_index)
        suffix = "fixed" if fixed else "SE=unavailable"
        if not fixed and np.any(gradient != 0) and not uncertainty_reason and np.isfinite(variance) and variance >= -1e-12:
            suffix = f"SE={np.sqrt(max(0, variance)):.12g}"
        print(f"  {label} = {moments[i]:.12g} ({suffix})")
`;

export const rootPeakModelHelpers = `
double peak_mode(double skew, double tail) {
  double lo = std::min(0.0, skew/tail), hi = std::max(0.0, skew/tail);
  for (int i=0; i<64; ++i) {
    const double t=lo/2+hi/2, u=tail*t-skew;
    if (tail*(std::tanh(u)-std::sinh(u)*std::cosh(u))-std::tanh(t)>0) lo=t;
    else hi=t;
  }
  return std::sinh(lo/2+hi/2);
}

double gaussian_peak(double x, const double *p) {
  if (!(p[3]>0 && p[5]>0)) return std::numeric_limits<double>::quiet_NaN();
  const double offset=(x-p[2])/p[3];
  if (p[4]==0 && p[5]==1) return p[0]+p[1]*std::exp(-0.5*offset*offset);
  const double zm=peak_mode(p[4],p[5]);
  auto log_shape = [&](double z) {
    const double u=p[5]*std::asinh(z)-p[4], a=std::abs(u), sh=std::sinh(u);
    return a+std::log1p(std::exp(-2*a))-std::log(2.0)-0.5*sh*sh-std::log(std::hypot(1.0,z));
  };
  return p[0]+p[1]*std::exp(log_shape(offset+zm)-log_shape(zm));
}
`;

export const rootPeakShapeHelpers = `${rootPeakModelHelpers}
std::vector<double> peak_moments(double skew, double tail) {
  if (!std::isfinite(skew) || !std::isfinite(tail) || !(tail>0)) return {};
  if (skew==0 && tail==1) return {0,0};
  // Standard-normal expectation rules generated with scipy.special.roots_hermitenorm.
  static const std::vector<std::vector<std::pair<double,double>>> rules = {
${normalQuadratureRules.map((rule) => `    {${rule.map(([z, w]) => `{${z},${w}}`).join(",")}}`).join(",\n")}
  };
  std::vector<std::vector<double>> estimates;
  for (const auto &rule : rules) {
    std::vector<double> values;
    double scale=0, mean=0, m2=0, m3=0, m4=0;
    for (const auto &node : rule) {
      const double v=std::sinh((std::asinh(node.first)+skew)/tail);
      values.push_back(v); scale=std::max(scale,std::abs(v));
    }
    if (!(scale>0) || !std::isfinite(scale)) return {};
    for (size_t i=0;i<values.size();++i) {values[i]/=scale; mean+=values[i]*rule[i].second;}
    for (size_t i=0;i<values.size();++i) {
      const double d=values[i]-mean, w=rule[i].second;
      m2+=w*d*d; m3+=w*d*d*d; m4+=w*d*d*d*d;
    }
    estimates.push_back({skew==0 ? 0 : m3/std::pow(m2,1.5), m4/(m2*m2)-3});
  }
  for (int i=0;i<2;++i)
    if (!std::isfinite(estimates[0][i]) || !std::isfinite(estimates[1][i]) ||
        std::abs(estimates[0][i]-estimates[1][i])>1e-8*(1+std::abs(estimates[1][i]))) return {};
  return estimates[1];
}

void report_peak_moments(TF1 &model, TFitResult &fit_result, const bool *fixed_parameters, bool errors_available) {
  const auto moments=model.GetParameter(1)==0 ? std::vector<double>{} : peak_moments(model.GetParameter(4),model.GetParameter(5));
  if (moments.empty()) {std::cout<<"Peak moments unavailable: zero height or unresolved numerical integration\\n";return;}
  double gradient[2][6] = {};
  for (int index : {4,5}) {
    if (fixed_parameters[index]) continue;
    std::vector<double> a(model.GetParameters(),model.GetParameters()+6), b=a;
    double step=1e-4*std::max(1.0,std::abs(a[index]));
    if (index==5) step=std::min(step,a[index]/100);
    a[index]+=step; b[index]-=step;
    const auto high=peak_moments(a[4],a[5]), low=peak_moments(b[4],b[5]);
    for (int q=0;q<2;++q) gradient[q][index]=high.empty() || low.empty() ? std::numeric_limits<double>::quiet_NaN() : (high[q]-low[q])/(2*step);
  }
  const char *labels[]={"Peak skewness","Peak excess kurtosis (Gaussian = 0)"};
  for (int q=0;q<2;++q) {
    if (q==1 && model.GetParameter(4)==0) gradient[q][4]=0;
    double variance=0; bool sensitive=false;
    const bool fixed=fixed_parameters[4] && ((q==0 && model.GetParameter(4)==0) || fixed_parameters[5]);
    for (int i=0;i<6;++i) {
      if (gradient[q][i]!=0) sensitive=true;
      for (int j=0;j<6;++j) variance+=gradient[q][i]*fit_result.CovMatrix(i,j)*gradient[q][j];
    }
    std::cout<<"  "<<labels[q]<<" = "<<moments[q];
    if (fixed) std::cout<<" (fixed)\\n";
    else if (sensitive && errors_available && std::isfinite(variance) && variance>=-1e-12) std::cout<<" (SE="<<std::sqrt(std::max(0.0,variance))<<")\\n";
    else std::cout<<" (SE=unavailable)\\n";
  }
}
`;
