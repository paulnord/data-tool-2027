import { it, expect } from "vitest";
import Ajv from "ajv";
import { z } from "zod/v4";
import { readFileSync, readdirSync } from "node:fs";
import {
  requestSchema,
  sessionSchema,
  acknowledgmentSchema,
  initialSettings,
  settingsSchema,
  createSession,
} from "../../src/core/fit/schema";
import { syntheticRequest } from "../support/synthetic";
const ajv = new Ajv({ strict: false, validateFormats: false });
const file = (name: string) => JSON.parse(readFileSync(name, "utf8"));
it("publishes reproducible strict JSON schemas and valid independent-validator fixtures", () => {
  for (const [name, schema, example, version] of [
    ["request", requestSchema, "synthetic-request.json", 1],
    ["session", sessionSchema, "synthetic-session.trksess", 7],
    ["ack", acknowledgmentSchema, "accepted-ack.json", 1],
  ] as const) {
    const published = file(`schemas/tracker-fit-${name}.v${version}.json`);
    const { title: _, $comment: __, ...actual } = published;
    expect(actual).toEqual(z.toJSONSchema(schema, { target: "draft-7" }));
    const validate = ajv.compile(published);
    const data = file(`examples/fit/${example}`);
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    expect(schema.safeParse(data).success).toBe(true);
    expect(validate({ ...data, derivedValue: 1 })).toBe(false);
  }
});
it("rejects invalid fixtures and semantic associations beyond JSON Schema", () => {
  expect(
    requestSchema.safeParse(file("examples/fit/invalid-extra-field.json"))
      .success,
  ).toBe(false);
  expect(
    requestSchema.safeParse(file("examples/fit/invalid-row-association.json"))
      .success,
  ).toBe(false);
  const r = syntheticRequest();
  r.dataset.rows[1].id = r.dataset.rows[0].id;
  expect(requestSchema.safeParse(r).success).toBe(false);
});
it("enforces missing-value reasons, consistency and unsupported fields at every boundary", () => {
  const r = syntheticRequest();
  r.dataset.rows[0].x = null;
  expect(requestSchema.safeParse(r).success).toBe(false);
  r.dataset.rows[0].missingReason = "missing-value";
  r.dataset.rows[0].included = false;
  expect(requestSchema.safeParse(r).success).toBe(true);
  expect(requestSchema.safeParse({ ...r, version: 2 }).success).toBe(false);
  expect(
    requestSchema.safeParse({ ...r, dataset: { ...r.dataset, velocity: 1 } })
      .success,
  ).toBe(false);
  r.uncertainty.errorStructure = "known-correlated";
  expect(requestSchema.safeParse(r).success).toBe(false);
});
it("round trips full precision and rejects session model/exclusion mismatches", () => {
  const session = {
    workspace: { kind: "single-fit" },
    view: { showResiduals: true, showGuides: false, showErrorBars: true },
    format: "tracker-fit-session",
    version: 7,
    request: syntheticRequest(),
    settings: initialSettings(),
    engine: "qr-vp-sine-2",
  };
  const parsed = sessionSchema.parse(session);
  expect(sessionSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(
    parsed,
  );
  expect(
    sessionSchema.safeParse({
      ...parsed,
      settings: { ...parsed.settings, excludedIds: ["nonexistent"] },
    }).success,
  ).toBe(false);
  expect(
    sessionSchema.safeParse({
      ...parsed,
      settings: { ...parsed.settings, model: "line" },
    }).success,
  ).toBe(false);
});

it("uses one session format for every model and rejects all retired versions", () => {
  for (const model of settingsSchema.shape.model.options) {
    const session = createSession({
      request: syntheticRequest(),
      settings: initialSettings(model),
    });
    expect(session.version).toBe(7);
    expect(session.workspace).toEqual({ kind: "single-fit" });
    expect(sessionSchema.parse(JSON.parse(JSON.stringify(session)))).toEqual(
      session,
    );
    for (const version of [0, 1, 2, 3, 4, 5, 6, 8])
      expect(sessionSchema.safeParse({ ...session, version }).success).toBe(
        false,
      );
    for (const field of ["workspace", "view"]) {
      const incomplete = { ...session } as Record<string, unknown>;
      delete incomplete[field];
      expect(sessionSchema.safeParse(incomplete).success).toBe(false);
    }
    expect(
      sessionSchema.safeParse({ ...session, engine: "qr-mgs2-1" }).success,
    ).toBe(false);
  }
});
it("every bundled example is a valid current session, including independent JSON Schema validation", () => {
  const validate = ajv.compile(file("schemas/tracker-fit-session.v7.json"));
  const paths = readdirSync("examples", {
    recursive: true,
    encoding: "utf8",
  }).filter((p) => p.endsWith(".trksess"));
  expect(paths).toHaveLength(42);
  for (const path of paths) {
    const session = file(`examples/${path}`);
    expect(sessionSchema.safeParse(session).success, path).toBe(true);
    expect(
      validate(session),
      `${path}: ${JSON.stringify(validate.errors)}`,
    ).toBe(true);
    expect(session.version).toBe(7);
    if (session.workspace.kind === "model-comparison")
      for (const candidate of session.workspace.candidates) {
        expect(candidate.analysis.version).toBeUndefined();
        expect(candidate.analysis.format).toBeUndefined();
      }
  }
});
