import { it, expect } from "vitest";
import Ajv from "ajv";
import { z } from "zod/v4";
import { readFileSync } from "node:fs";
import {
  requestSchema,
  sessionSchema,
  sessionV1Schema,
  sessionV2Schema,
  acknowledgmentSchema,
  initialSettings,
} from "../../src/core/fit/schema";
import { syntheticRequest } from "../support/synthetic";
const ajv = new Ajv({ strict: false, validateFormats: false });
const file = (name: string) => JSON.parse(readFileSync(name, "utf8"));
it("publishes reproducible strict JSON schemas and valid independent-validator fixtures", () => {
  for (const [name, schema, example] of [
    ["request", requestSchema, "synthetic-request.json"],
    ["session", sessionV1Schema, "synthetic-session.trksess"],
    ["ack", acknowledgmentSchema, "accepted-ack.json"],
  ] as const) {
    const published = file(`schemas/tracker-fit-${name}.v1.json`);
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
    format: "tracker-fit-session",
    version: 1,
    request: syntheticRequest(),
    settings: initialSettings(),
    engine: "qr-mgs2-1",
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

it("publishes a separate v2 session schema while v1 rejects new models", () => {
  const published = file("schemas/tracker-fit-session.v2.json");
  const { title: _, $comment: __, ...actual } = published;
  expect(actual).toEqual(
    z.toJSONSchema(sessionV2Schema, { target: "draft-7" }),
  );
  const example = file("examples/fit/nonlinear-session-v2.trksess");
  const validate = ajv.compile(published);
  expect(validate(example), JSON.stringify(validate.errors)).toBe(true);
  expect(sessionSchema.safeParse(example).success).toBe(true);
  expect(
    sessionV1Schema.safeParse({
      ...example,
      version: 1,
      engine: "qr-vp-sine-2",
    }).success,
  ).toBe(false);
  expect(sessionSchema.safeParse({ ...example, version: 3 }).success).toBe(
    false,
  );
});
