import { existsSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";
import { publishedStudyCatalog } from "../../src/fit/publishedCatalog";

const dir = "examples/data/published";

it("classifies every published study exactly once with data and documentation", () => {
  const names = publishedStudyCatalog.map(({ fileName }) => fileName);
  expect(new Set(names).size).toBe(names.length);
  expect(publishedStudyCatalog).toHaveLength(16);

  const listedData = names.map((fileName) =>
    fileName.replace(/\.trksess$/, ".csv"),
  );
  const availableData = readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".csv"))
    .sort();
  expect([...listedData].sort()).toEqual(availableData);

  for (const { fileName } of publishedStudyCatalog) {
    expect(existsSync(`${dir}/${fileName}`)).toBe(true);
    expect(
      existsSync(`${dir}/${fileName.replace(/\.(?:trksess|csv)$/, ".md")}`),
    ).toBe(true);
  }
});

it("reserves Reproduced for the clean literature benchmark", () => {
  expect(
    publishedStudyCatalog
      .filter(({ status }) => status === "Reproduced")
      .map(({ fileName }) => fileName),
  ).toEqual(["besiii-ppbarpi0-continuum.trksess"]);
  expect(
    publishedStudyCatalog.find(({ fileName }) =>
      fileName.includes("asassn14li-xray"),
    )?.status,
  ).toBe("Not reproduced");
  expect(
    publishedStudyCatalog.find(({ fileName }) =>
      fileName.includes("photon-index"),
    )?.status,
  ).toBe("Unsupported");
});
