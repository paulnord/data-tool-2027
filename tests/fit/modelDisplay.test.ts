import { expect, it } from "vitest";
import { polynomialBasisTerms } from "../../src/core/fit/seriesModels";
import { initialSettings } from "../../src/core/fit/schema";
import { modelDisplayName } from "../../src/fit/modelDisplay";

it("lists the actual terms used by each polynomial representation", () => {
  expect(polynomialBasisTerms(2, "power")).toBe("1, x, x²");
  expect(polynomialBasisTerms(2, "taylor")).toBe("1, (x−a), (x−a)²/2!");
  expect(polynomialBasisTerms(2, "chebyshev")).toBe("T₀(z), T₁(z), T₂(z)");
  expect(polynomialBasisTerms(10, "chebyshev")).toBe(
    "T₀(z), T₁(z), T₂(z), …, T₁₀(z)",
  );
});

it("describes polynomial comparison candidates by degree and representation", () => {
  expect(modelDisplayName(initialSettings("quadratic"))).toBe(
    "Polynomial · degree 2 · powers of x",
  );
  expect(
    modelDisplayName({
      ...initialSettings("cubic"),
      polynomialBasis: { kind: "taylor", center: 1.25 },
    }),
  ).toBe("Taylor polynomial · degree 3 · center 1.25");
  expect(
    modelDisplayName({
      ...initialSettings("polynomial-5"),
      polynomialBasis: { kind: "chebyshev", center: 2.5, scale: 4 },
    }),
  ).toBe("Chebyshev polynomial · degree 5 · center 2.5, scale 4");
});
