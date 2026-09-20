import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.use({ storageState: { cookies: [], origins: [] } });

const example = "examples/data/ball-toss.trksess";

async function review(page: Page, file: string | object) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      typeof file === "string"
        ? file
        : {
            name: "advanced-series.trksess",
            mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify(file)),
          },
    );
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

async function open(page: Page, file: string | object = example) {
  await page.goto("/");
  await review(page, file);
}

async function enableAdvanced(page: Page) {
  const menu = page.locator(".fit-settings-menu");
  await menu.locator("summary").click();
  await page
    .getByLabel("Show advanced models and analysis tools", { exact: true })
    .check();
  await menu.locator("summary").click();
}

async function save(page: Page) {
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save session", exact: true }).click();
  const download = await pending;
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

async function reopen(context: BrowserContext, session: object) {
  const page = await context.newPage();
  await open(page, session);
  return page;
}

test("advanced opt-in reveals one polynomial family and its series representations", async ({
  page,
}) => {
  await open(page);
  const model = page.getByLabel("Model", { exact: true });

  await expect(model.locator('option[value="fourier"]')).toHaveCount(0);
  await model.selectOption("polynomial");
  await expect(
    page.getByLabel("Polynomial representation", { exact: true }),
  ).toHaveCount(0);

  const degree = page.getByLabel("Model polynomial degree", { exact: true });
  await expect(degree.locator("option")).toHaveCount(9);
  await expect(degree.locator("option")).toHaveText([
    "2 — quadratic",
    "3 — cubic",
    "4 — quartic",
    "5 — quintic",
    "6",
    "7",
    "8",
    "9",
    "10",
  ]);

  await enableAdvanced(page);
  await expect(model.locator('option[value="fourier"]')).toHaveCount(1);
  const representation = page.getByLabel("Polynomial representation", {
    exact: true,
  });
  await expect(representation.locator("option")).toHaveText([
    "Powers of x",
    "Taylor series",
    "Chebyshev basis",
  ]);
  await expect(page.getByLabel("Model", { exact: true })).toHaveValue(
    "polynomial",
  );
  await expect(degree).toHaveValue("quadratic");
});

test("Taylor and Chebyshev metadata survive session save and reopen", async ({
  page,
  context,
}) => {
  await open(page);
  await enableAdvanced(page);
  await page.getByLabel("Model", { exact: true }).selectOption("polynomial");
  await page
    .getByLabel("Model polynomial degree", { exact: true })
    .selectOption("cubic");
  await page
    .getByLabel("Polynomial representation", { exact: true })
    .selectOption("taylor");
  await page
    .getByLabel("Taylor expansion center", { exact: true })
    .fill("1.25");

  const taylor = await save(page);
  expect(taylor.settings.model).toBe("cubic");
  expect(taylor.settings.polynomialBasis).toEqual({
    kind: "taylor",
    center: 1.25,
  });

  const taylorPage = await reopen(context, taylor);
  await expect(
    taylorPage.getByLabel("Polynomial representation", { exact: true }),
  ).toHaveValue("taylor");
  await expect(
    taylorPage.getByLabel("Taylor expansion center", { exact: true }),
  ).toHaveValue("1.25");
  await taylorPage
    .getByLabel("Polynomial representation", { exact: true })
    .selectOption("chebyshev");
  await taylorPage
    .getByLabel("Chebyshev basis center", { exact: true })
    .fill("0.75");
  await taylorPage
    .getByLabel("Chebyshev basis scale", { exact: true })
    .fill("2.5");

  const chebyshev = await save(taylorPage);
  expect(chebyshev.settings.model).toBe("cubic");
  expect(chebyshev.settings.polynomialBasis).toEqual({
    kind: "chebyshev",
    center: 0.75,
    scale: 2.5,
  });

  await taylorPage.evaluate(() =>
    localStorage.removeItem("data-tool-2027.advanced-features"),
  );
  const chebyshevPage = await reopen(context, chebyshev);
  expect(
    await chebyshevPage.evaluate(() =>
      localStorage.getItem("data-tool-2027.advanced-features"),
    ),
  ).toBeNull();
  await expect(
    chebyshevPage.getByLabel("Polynomial representation", { exact: true }),
  ).toHaveValue("chebyshev");
  await expect(
    chebyshevPage.getByLabel("Chebyshev basis center", { exact: true }),
  ).toHaveValue("0.75");
  await expect(
    chebyshevPage.getByLabel("Chebyshev basis scale", { exact: true }),
  ).toHaveValue("2.5");
  await chebyshevPage.close();
  await taylorPage.close();
});

test("Fourier harmonics resize parameters and fixed metadata survive a fit", async ({
  page,
  context,
}) => {
  await open(page);
  await enableAdvanced(page);
  await page.getByLabel("Model", { exact: true }).selectOption("fourier");

  await expect(page.getByLabel("s1 value", { exact: true })).toBeVisible();
  await expect(page.getByLabel("s2 value", { exact: true })).toHaveCount(0);
  await page.getByLabel("Fourier period", { exact: true }).fill("3.5");
  await page.getByLabel("Fourier origin", { exact: true }).fill("0.25");

  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");
  const fittedS1 = Number(
      await page.getByLabel("s1 value", { exact: true }).inputValue(),
    ),
    fittedC1 = Number(
      await page.getByLabel("c1 value", { exact: true }).inputValue(),
    );

  await page.getByLabel("Fourier harmonics", { exact: true }).selectOption("3");
  expect(
    Number(await page.getByLabel("s1 value", { exact: true }).inputValue()),
  ).toBeCloseTo(fittedS1, 5);
  expect(
    Number(await page.getByLabel("c1 value", { exact: true }).inputValue()),
  ).toBeCloseTo(fittedC1, 5);
  for (const name of ["s2", "c2", "s3", "c3"])
    await expect(page.getByLabel(`${name} value`, { exact: true })).toHaveValue(
      "0",
    );
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");

  const session = await save(page);
  expect(session.settings.model).toBe("fourier");
  expect(session.settings.fourier).toEqual({
    harmonics: 3,
    period: 3.5,
    origin: 0.25,
  });
  expect(session.settings.parameters).toHaveLength(7);

  const reopened = await reopen(context, session);
  await expect(
    reopened.getByLabel("Fourier harmonics", { exact: true }),
  ).toHaveValue("3");
  await expect(
    reopened.getByLabel("Fourier period", { exact: true }),
  ).toHaveValue("3.5");
  await expect(
    reopened.getByLabel("Fourier origin", { exact: true }),
  ).toHaveValue("0.25");
  await expect(reopened.getByLabel("s3 value", { exact: true })).toBeVisible();
  await reopened
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(reopened.getByRole("status")).toHaveText("Fit complete");
  await reopened.close();
});

test("Fourier harmonic resizing preserves fitted coefficients in model comparison", async ({
  page,
}) => {
  await open(page);
  await enableAdvanced(page);
  await page.getByLabel("Model", { exact: true }).selectOption("fourier");
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("model-comparison");

  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(
    page.locator(".model-comparison").getByRole("status"),
  ).toHaveText("Comparison complete");

  const fittedS1 = Number(
      await page
        .getByLabel("Candidate 1 s1 value", { exact: true })
        .inputValue(),
    ),
    fittedC1 = Number(
      await page
        .getByLabel("Candidate 1 c1 value", { exact: true })
        .inputValue(),
    );

  await page
    .getByLabel("Candidate 1 Fourier harmonics", { exact: true })
    .selectOption("3");
  expect(
    Number(
      await page
        .getByLabel("Candidate 1 s1 value", { exact: true })
        .inputValue(),
    ),
  ).toBeCloseTo(fittedS1, 5);
  expect(
    Number(
      await page
        .getByLabel("Candidate 1 c1 value", { exact: true })
        .inputValue(),
    ),
  ).toBeCloseTo(fittedC1, 5);
  for (const name of ["s2", "c2", "s3", "c3"])
    await expect(
      page.getByLabel(`Candidate 1 ${name} value`, { exact: true }),
    ).toHaveValue("0");

  await page
    .getByLabel("Candidate 1 Fourier period", { exact: true })
    .fill("0.00137");
  await page
    .getByRole("button", { name: "Refit and compare", exact: true })
    .click();
  await expect(
    page.locator(".model-comparison").getByRole("status"),
  ).toHaveText("Comparison complete");
  await expect(
    page.locator(".comparison-plot-wrap").getByRole("note"),
  ).toContainText("Curve 1 unavailable at this period/view");
  await expect(
    page.locator('.comparison-plot desc[data-plot-notice="true"]'),
  ).toContainText("Curve 1 unavailable at this period/view");
});

test("multi-interval discloses a Fourier curve that is too dense to render", async ({
  page,
}) => {
  await open(page);
  await enableAdvanced(page);
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("multi-interval");
  await page.getByLabel("Interval from", { exact: true }).fill("0");
  await page.getByLabel("Interval to", { exact: true }).fill("2");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("fourier");
  await page
    .getByLabel("Interval Fourier period", { exact: true })
    .fill("0.001");
  const assumptions = page.getByRole("checkbox", {
    name: "Accept uncertainty assumptions",
    exact: true,
  });
  if (await assumptions.isVisible()) await assumptions.check();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();

  const workspace = page.getByRole("region", {
    name: "Multi-interval analysis",
    exact: true,
  });
  await expect(workspace.getByRole("status")).toHaveText(
    "Interval 1: fit complete",
  );
  await expect(workspace.getByRole("note")).toContainText(
    "Fitted curve for Interval 1 unavailable at this period/view",
  );
  await expect(
    workspace.locator('.interval-plot desc[data-plot-notice="true"]'),
  ).toContainText(
    "Fitted curve for Interval 1 unavailable at this period/view",
  );
});
