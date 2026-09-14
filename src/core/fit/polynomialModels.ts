export const higherPolynomialIds = [
  "polynomial-5",
  "polynomial-6",
  "polynomial-7",
  "polynomial-8",
  "polynomial-9",
  "polynomial-10",
] as const;

export const polynomialIds = [
  "quadratic",
  "cubic",
  "quartic",
  ...higherPolynomialIds,
] as const;
export type PolynomialModel = (typeof polynomialIds)[number];

export function polynomialDegree(model: string): number | undefined {
  const index = (polynomialIds as readonly string[]).indexOf(model);
  return index < 0 ? undefined : index + 2;
}

export function polynomialExpressions(
  term: (degree: number) => string,
): Record<PolynomialModel, string> {
  return Object.fromEntries(
    polynomialIds.map((model, index) => [
      model,
      Array.from({ length: index + 3 }, (_, degree) => term(degree)).join(
        " + ",
      ),
    ]),
  ) as Record<PolynomialModel, string>;
}
