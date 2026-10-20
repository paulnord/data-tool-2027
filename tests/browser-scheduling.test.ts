import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";
import config from "../playwright.config";

test("real clipboard cases stay in the single-worker project", () => {
  let clipboardCases = 0;
  for (const file of readdirSync("e2e").filter((name) =>
    name.endsWith(".spec.ts"),
  )) {
    const source = ts.createSourceFile(
      file,
      readFileSync(join("e2e", file), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.getText(source) === "test"
      ) {
        const body = node.arguments.at(-1)!.getText(source);
        // Covers current real-clipboard API and permission use. New helpers that
        // touch the system clipboard must also mark their calling tests.
        if (/navigator\.clipboard|clipboard-read|clipboard-write/.test(body)) {
          clipboardCases++;
          expect(
            node.arguments[1].getText(source),
            `${file}: ${node.arguments[0].getText(source)}`,
          ).toContain("@clipboard");
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  expect(clipboardCases).toBeGreaterThan(0);
  const clipboard = config.projects!.find(
    (project) => project.name === "clipboard",
  )!;
  const independent = config.projects!.find(
    (project) => project.name === "independent",
  )!;
  expect(clipboard.workers).toBe(1);
  expect(clipboard.fullyParallel).toBe(false);
  expect(clipboard.grep).toEqual(/@clipboard/);
  expect(independent.grepInvert).toEqual(/@clipboard/);
  expect(config.fullyParallel).toBe(true);
  expect(config.workers).toBe(process.env.CI ? 2 : undefined);
});
