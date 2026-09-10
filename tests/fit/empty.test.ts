import { expect, it } from "vitest";
import { emptyRequest } from "../../src/core/fit/empty";
import { requestSchema } from "../../src/core/fit/schema";
it("new analyses contain no invented data, units, or uncertainty assumptions", () => {
  const r = emptyRequest(
    "e7c00000-0000-4000-8000-000000000001",
    "e7c00000-0000-4000-8000-000000000002",
  );
  expect(r.dataset.rows).toEqual([]);
  expect(r.dataset.xColumn.unit).toBeNull();
  expect(r.uncertainty).toEqual({
    kind: "unknown-equal",
    errorStructure: "unknown",
  });
  expect(Object.values(r.dataset.assumptions)).toEqual([
    "unknown",
    "unknown",
    "unknown",
  ]);
  expect(requestSchema.parse(JSON.parse(JSON.stringify(r)))).toEqual(r);
});
