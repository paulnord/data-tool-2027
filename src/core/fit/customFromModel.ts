import {
  initialSettings,
  parameterNames,
  type FitSettings,
  type FitRequest,
} from "./schema";
import { inspectEquation } from "./customEquation";
import { isNonlinearModel, nonlinearParameterUnit } from "./nonlinearModels";
/** Explicit conversion preserves the physical coefficients and fixed assertions. */
export function customFromModel(
  settings: FitSettings,
  request: FitRequest,
  coefficients?: number[],
): FitSettings {
  if (settings.model === "custom") return settings;
  const equations = {
    line: "b+m*x",
    quadratic: "c0+c1*x+c2*x^2",
    cubic: "c0+c1*x+c2*x^2+c3*x^3",
    quartic: "c0+c1*x+c2*x^2+c3*x^3+c4*x^4",
    logarithmic: "b+a*ln(x)",
    sine: "b+s*sin(2*pi*x/T)+c*cos(2*pi*x/T)",
    "sine-free-period": "b+s*sin(2*pi*x/T)+c*cos(2*pi*x/T)",
    exponential: "b+a*exp(k*x)",
    "power-law": "b+a*x^p",
    reciprocal: "b+a/x",
    "constant-acceleration": "y0+v0*t+0.5*a*t^2",
    "exponential-decay": "b+A*exp(-x/tau)",
    "power-law-free": "b+A*x^n",
    gaussian: "b+A*exp(-0.5*((x-mu)/sigma)^2)",
    "damped-sine": "b+exp(-x/tau)*(s*sin(2*pi*x/T)+c*cos(2*pi*x/T))",
    lorentzian: "b+A/(1+((x-mu)/gamma)^2)",
  };
  const expression = equations[settings.model],
    variable = settings.model === "constant-acceleration" ? "t" : "x";
  const names = inspectEquation(expression, variable).names,
    oldNames = parameterNames(settings.model);
  const xu = request.dataset.xColumn.unit ?? "?",
    yu = request.dataset.yColumn.unit ?? "?";
  const entries = new Map(
    oldNames.map((name, i) => [
      name,
      {
        parameter: {
          ...settings.parameters[i],
          value: coefficients?.[i] ?? settings.parameters[i].value,
        },
        unit: isNonlinearModel(settings.model)
          ? nonlinearParameterUnit(settings.model, i, xu, yu)
          : settings.model === "sine-free-period" && i === 3
            ? xu
            : i === 0 ||
                [
                  "logarithmic",
                  "sine",
                  "sine-free-period",
                  "exponential",
                  "power-law",
                  "reciprocal",
                ].includes(settings.model)
              ? yu
              : `${yu}/${xu}${i > 1 ? `^${i}` : ""}`,
      },
    ]),
  );
  if (settings.model === "sine")
    entries.set("T", {
      parameter: { value: settings.sinePeriod ?? 2 * Math.PI, fixed: true },
      unit: xu,
    });
  if (settings.model === "exponential")
    entries.set("k", {
      parameter: { value: settings.shape ?? -1, fixed: true },
      unit: `1/${xu}`,
    });
  if (settings.model === "power-law")
    entries.set("p", {
      parameter: { value: settings.shape ?? 2, fixed: true },
      unit: "1",
    });
  return {
    ...initialSettings("custom"),
    custom: {
      expression,
      variable,
      names,
      units: names.map((n) => entries.get(n)!.unit),
    },
    parameters: names.map((n) => entries.get(n)!.parameter),
    excludedIds: settings.excludedIds.slice(),
    conditionalInference: false,
    physicalTimeConfirmed: settings.physicalTimeConfirmed,
    selectionAfterInspection: settings.selectionAfterInspection,
    retainedPerRowUncertainty: settings.retainedPerRowUncertainty,
  };
}
