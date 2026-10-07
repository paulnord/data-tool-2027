import type { FitSettings } from "./schema";

export function usesMoyal(settings: FitSettings) {
  return (
    settings.model === "moyal" ||
    (settings.model === "custom" &&
      /\bmoyal\s*\(/.test(settings.custom!.expression))
  );
}

export const pythonMoyalHelper = `# Unit-area Moyal; mode zero, scale one. Closed-form evaluation.
def moyal_pdf(z):
    z = np.asarray(z, dtype=float)
    zero = (z < -8) | np.isinf(z)
    safe = np.where(zero, 0.0, z)
    with np.errstate(under="ignore"):
        value = np.exp(-0.5 * (safe + np.exp(-safe)) - 0.5 * np.log(2 * np.pi))
    return np.where(zero, 0.0, value)
`;

export const rootMoyalHelper = `// Unit-area Moyal; mode zero, scale one. Closed-form evaluation.
double moyal_pdf(double z) {
  if (std::isinf(z) || z < -8.0) return 0.0;
  return std::exp(-0.5 * (z + std::exp(-z)) - 0.5 * std::log(2.0 * TMath::Pi()));
}
`;
