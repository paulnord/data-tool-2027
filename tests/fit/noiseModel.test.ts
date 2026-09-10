import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { switchNoiseModel } from "../../src/core/fit/noiseModel";
import { sessionSchema, initialSettings } from "../../src/core/fit/schema";
import { syntheticRequest } from "../support/synthetic";
const fixture = () =>
  sessionSchema.parse(
    JSON.parse(
      readFileSync("examples/fit/unequal-weights-demo.trksess", "utf8"),
    ),
  );
it("restores the exact original per-row values and provenance after switching through both equal modes", () => {
  const original = fixture(),
    before = JSON.stringify(original);
  let state = switchNoiseModel(
    original.request,
    original.settings,
    "unknown-equal",
  );
  expect(state.request.dataset).toBe(original.request.dataset);
  expect(state.settings.retainedPerRowUncertainty).toBe(
    original.request.uncertainty,
  );
  state = switchNoiseModel(state.request, state.settings, "supplied-common");
  state = switchNoiseModel(state.request, state.settings, "supplied-per-row");
  expect(state.request.uncertainty).toBe(original.request.uncertainty);
  expect(JSON.stringify(original)).toBe(before);
});
it("retained uncertainties survive saving and reopening while equal weights are selected", () => {
  const original = fixture(),
    equal = switchNoiseModel(
      original.request,
      original.settings,
      "unknown-equal",
    );
  const reopened = sessionSchema.parse(
    JSON.parse(JSON.stringify({ ...original, ...equal })),
  );
  const restored = switchNoiseModel(
    reopened.request,
    reopened.settings,
    "supplied-per-row",
  );
  expect(restored.request.uncertainty).toEqual(original.request.uncertainty);
  const bad = structuredClone(reopened);
  bad.settings.retainedPerRowUncertainty!.sigmaByRow["not-a-row"] = 1;
  expect(() => sessionSchema.parse(bad)).toThrow();
  delete bad.settings.retainedPerRowUncertainty!.sigmaByRow["not-a-row"];
  delete bad.settings.retainedPerRowUncertainty!.sigmaByRow["row-0"];
  expect(() => sessionSchema.parse(bad)).toThrow();
});
it("a new dataset cannot acquire another dataset’s uncertainties", () => {
  expect(() =>
    switchNoiseModel(syntheticRequest(), initialSettings(), "supplied-per-row"),
  ).toThrow(/No supplied/);
});
