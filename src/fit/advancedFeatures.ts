export const ADVANCED_FEATURES_STORAGE_KEY = "data-tool-2027.advanced-features";

export function readAdvancedFeatures(): boolean {
  try {
    return (
      window.localStorage.getItem(ADVANCED_FEATURES_STORAGE_KEY) === "true"
    );
  } catch {
    return false;
  }
}

export function storeAdvancedFeatures(enabled: boolean): boolean {
  try {
    if (enabled)
      window.localStorage.setItem(ADVANCED_FEATURES_STORAGE_KEY, "true");
    else window.localStorage.removeItem(ADVANCED_FEATURES_STORAGE_KEY);
    return enabled;
  } catch {
    // Storage can be blocked or quota-limited. Keep the user's choice for the
    // current session even when the browser cannot persist it across reloads.
    return enabled;
  }
}
