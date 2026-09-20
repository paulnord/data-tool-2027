import { afterEach, expect, it, vi } from "vitest";
import {
  readAdvancedFeatures,
  storeAdvancedFeatures,
} from "../../src/fit/advancedFeatures";

afterEach(() => vi.unstubAllGlobals());

it("keeps the in-memory advanced choice when local storage is blocked", () => {
  vi.stubGlobal("window", {
    localStorage: {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    },
  });

  expect(readAdvancedFeatures()).toBe(false);
  expect(storeAdvancedFeatures(true)).toBe(true);
  expect(storeAdvancedFeatures(false)).toBe(false);
});
