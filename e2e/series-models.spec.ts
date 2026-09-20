import { expect, test, type Page } from "@playwright/test";

async function openBallToss(page: Page) {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles("examples/data/ball-toss.trksess");
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
}

test("series representations are shared by single, comparison, and interval fits", async ({
  page,
}) => {
  await openBallToss(page);

  const model = page.getByLabel("Model", { exact: true });
  await model.selectOption("polynomial");
  const representation = page.getByLabel("Polynomial representation", {
    exact: true,
  });
  await representation.selectOption("taylor");
  await expect(
    page.getByLabel("Taylor expansion center", { exact: true }),
  ).toBeVisible();
  await representation.selectOption("chebyshev");
  await expect(
    page.getByLabel("Chebyshev basis scale", { exact: true }),
  ).toHaveValue(/\d/);

  await model.selectOption("fourier");
  await page.getByLabel("Fourier harmonics", { exact: true }).selectOption("3");
  await expect(page.getByLabel("s3 value", { exact: true })).toBeVisible();
  await page.getByLabel("Fourier period", { exact: true }).fill("5");
  await page.getByLabel("Fourier origin", { exact: true }).fill("1");
  await page
    .getByRole("button", { name: "Fit selected observations", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Fit complete");

  const tools = page.getByLabel("Analysis tools", { exact: true });
  await tools.selectOption("model-comparison");
  await expect(
    page.getByLabel("Candidate 1 Fourier harmonics", { exact: true }),
  ).toHaveValue("3");
  await expect(
    page.getByLabel("Candidate 1 s3 value", { exact: true }),
  ).toBeVisible();

  await tools.selectOption("multi-interval");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("fourier");
  await page
    .getByLabel("Interval Fourier harmonics", { exact: true })
    .selectOption("2");
  await expect(
    page.getByLabel("s2 interval value", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Interval from", { exact: true }).fill("0");
  await page.getByLabel("Interval to", { exact: true }).fill("2");
  await page
    .getByRole("checkbox", {
      name: "Accept uncertainty assumptions",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Fit Interval 1", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", {
        name: "Multi-interval analysis",
        exact: true,
      })
      .getByRole("status"),
  ).toHaveText("Interval 1: fit complete");
});

test("polynomial degree changes preserve the selected representation in every workspace", async ({
  page,
}) => {
  await openBallToss(page);

  await page.getByLabel("Model", { exact: true }).selectOption("polynomial");
  await page
    .getByLabel("Polynomial representation", { exact: true })
    .selectOption("chebyshev");
  await page.getByLabel("Chebyshev basis center", { exact: true }).fill("1.25");
  await page.getByLabel("Chebyshev basis scale", { exact: true }).fill("3.5");
  await page
    .getByLabel("Model polynomial degree", { exact: true })
    .selectOption("cubic");
  await expect(
    page.getByLabel("Polynomial representation", { exact: true }),
  ).toHaveValue("chebyshev");
  await expect(
    page.getByLabel("Chebyshev basis center", { exact: true }),
  ).toHaveValue("1.25");
  await expect(
    page.getByLabel("Chebyshev basis scale", { exact: true }),
  ).toHaveValue("3.5");

  const tools = page.getByLabel("Analysis tools", { exact: true });
  await tools.selectOption("model-comparison");
  await page
    .getByLabel("Candidate 1 model polynomial degree", { exact: true })
    .selectOption("quartic");
  await expect(
    page.getByLabel("Candidate 1 Polynomial representation", { exact: true }),
  ).toHaveValue("chebyshev");
  await expect(
    page.getByLabel("Candidate 1 Chebyshev basis center", { exact: true }),
  ).toHaveValue("1.25");
  await expect(
    page.getByLabel("Candidate 1 Chebyshev basis scale", { exact: true }),
  ).toHaveValue("3.5");

  await tools.selectOption("multi-interval");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("polynomial");
  await page
    .getByLabel("Interval Polynomial representation", { exact: true })
    .selectOption("taylor");
  await page
    .getByLabel("Interval Taylor expansion center", { exact: true })
    .fill("2.75");
  await page
    .getByLabel("Interval equation polynomial degree", { exact: true })
    .selectOption("polynomial-5");
  await expect(
    page.getByLabel("Interval Polynomial representation", { exact: true }),
  ).toHaveValue("taylor");
  await expect(
    page.getByLabel("Interval Taylor expansion center", { exact: true }),
  ).toHaveValue("2.75");
});

test("multi-interval basis suggestions ignore blank X cells", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "blank-x.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("Time (s),Position (m)\n10,1\n,2\n20,3"),
    });
  await page
    .getByRole("button", { name: "Use these data", exact: true })
    .click();
  await page
    .getByLabel("Analysis tools", { exact: true })
    .selectOption("multi-interval");
  await page
    .getByLabel("Interval equation", { exact: true })
    .selectOption("polynomial");
  await page
    .getByLabel("Interval Polynomial representation", { exact: true })
    .selectOption("chebyshev");

  await expect(
    page.getByLabel("Interval Chebyshev basis center", { exact: true }),
  ).toHaveValue("15");
  await expect(
    page.getByLabel("Interval Chebyshev basis scale", { exact: true }),
  ).toHaveValue("5");
});
