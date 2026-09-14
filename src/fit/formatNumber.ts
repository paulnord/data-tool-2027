/** Compact display only; calculations and exported observations retain precision. */
export function usesScientificNotation(value: number): boolean {
  const magnitude = Math.abs(value);
  return magnitude > 0 && (magnitude < 1e-4 || magnitude >= 1e7);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "Unavailable";
  if (usesScientificNotation(value))
    return Number(value.toPrecision(7)).toExponential();
  return value.toLocaleString("en-US", { maximumSignificantDigits: 7 });
}

/** Exact round-trip text for controls; never round a stored starting value. */
export function formatEditableNumber(value: number): string {
  return usesScientificNotation(value) ? value.toExponential() : String(value);
}
