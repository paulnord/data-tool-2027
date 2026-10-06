import type { FitSettings } from "./schema";
import { LANDAU_BOOST_MODE, LANDAU_ROOT_MODE, LANDAU_SCALE } from "./landau";

export function usesLandau(settings: FitSettings) {
  return (
    settings.model === "landau" ||
    (settings.model === "custom" &&
      /\blandau\s*\(/.test(settings.custom!.expression))
  );
}

export const pythonLandauHelper = `# Unit-area, mode-zero Landau; w uses ROOT's width convention.
# scipy.stats.landau requires SciPy >= 1.15. Its raw loc/scale differ from ROOT.
from scipy.stats import landau as _scipy_landau

def landau_pdf(z):
    return ${LANDAU_SCALE} * _scipy_landau.pdf(${LANDAU_SCALE} * np.asarray(z) + (${LANDAU_BOOST_MODE}))
`;

export const rootLandauHelper = `// Unit-area, mode-zero Landau; same width convention as TMath::Landau.
// TMath's approximation has slightly lower precision than the browser PDF.
double landau_pdf(double z) {
  return TMath::Landau(z + (${LANDAU_ROOT_MODE}), 0.0, 1.0, true);
}
`;
