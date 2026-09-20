import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { initialSettings } from "../../src/core/fit/schema";
import { fit } from "../../src/core/fit/solve";
import { IntervalPlot } from "../../src/fit/IntervalPlot";
import { syntheticRequest } from "../support/synthetic";

it("discloses an interval curve that is too dense in live and export rendering", () => {
  const request = syntheticRequest();
  const settings = initialSettings("fourier");
  settings.fourier = { harmonics: 1, period: 0.001, origin: 0 };
  const result = fit(request, settings);
  const intervals = [
    {
      name: "Interval 1",
      range: [0, 2] as [number, number],
      settings: [settings],
    },
  ];
  const results = [{ request, settings, result, error: null }];
  const message =
    "Fitted curve for Interval 1 unavailable at this period/view; zoom in or use a valid period.";
  const props = {
    request,
    intervals,
    results,
    active: 0,
    domain: [0, 2] as [number, number],
  };

  const live = renderToStaticMarkup(createElement(IntervalPlot, props));
  expect(live).toContain(
    `<p class="fit-log-notice" role="note">${message}</p>`,
  );
  expect(live).toContain(`<desc data-plot-notice="true">${message}</desc>`);

  const exported = renderToStaticMarkup(
    createElement(IntervalPlot, {
      ...props,
      renderSize: { width: 600, height: 300, fontSizePx: 12 },
    }),
  );
  expect(exported).not.toContain('role="note"');
  expect(exported).toContain(`<desc data-plot-notice="true">${message}</desc>`);
});
