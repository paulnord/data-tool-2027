import { useEffect, useRef } from "react";
import { polynomialDegree } from "../core/fit/polynomialModels";
import {
  DEFAULT_FOURIER_SETTINGS,
  effectivePolynomialBasis,
  fourierHarmonicCounts,
  fourierParameterNames,
  polynomialBasisTerms,
  type FourierHarmonics,
  type PolynomialBasisKind,
} from "../core/fit/seriesModels";
import { parameterNames, type FitSettings } from "../core/fit/schema";
import { EditableNumber } from "./EditableNumber";

function suggestedDomain(xValues: readonly (number | null)[]) {
  let low = Infinity,
    high = -Infinity;
  for (const value of xValues)
    if (value !== null && Number.isFinite(value)) {
      low = Math.min(low, value);
      high = Math.max(high, value);
    }
  if (!Number.isFinite(low) || !Number.isFinite(high))
    return { center: 0, scale: 1 };
  const center = low / 2 + high / 2,
    scale = high / 2 - low / 2;
  return {
    center: Number.isFinite(center) ? center : 0,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
  };
}

export function SeriesModelControls({
  settings,
  xValues,
  xUnit,
  advancedFeatures = false,
  labelPrefix = "",
  onChange,
  onInvalidChange,
  onRestoreInvalid,
}: {
  settings: FitSettings;
  xValues: readonly (number | null)[];
  xUnit?: string | null;
  advancedFeatures?: boolean;
  labelPrefix?: string;
  onChange: (settings: FitSettings) => void;
  onInvalidChange?: (invalid: boolean) => void;
  onRestoreInvalid?: () => void;
}) {
  const invalidFields = useRef(new Set<string>()),
    invalidCallback = useRef(onInvalidChange);
  useEffect(() => {
    invalidCallback.current = onInvalidChange;
  }, [onInvalidChange]);
  useEffect(
    () => () => {
      if (invalidFields.current.size) invalidCallback.current?.(false);
    },
    [],
  );
  function invalid(field: string, value: boolean) {
    const wasInvalid = invalidFields.current.size > 0;
    if (value) invalidFields.current.add(field);
    else invalidFields.current.delete(field);
    const isInvalid = invalidFields.current.size > 0;
    if (wasInvalid !== isInvalid) invalidCallback.current?.(isInvalid);
  }
  const numberProps = (field: string) => ({
    onInvalidChange: (value: boolean) => invalid(field, value),
    onRestoreInvalid: () => onRestoreInvalid?.(),
  });

  const degree = polynomialDegree(settings.model);
  if (degree !== undefined) {
    const basis = effectivePolynomialBasis(settings.polynomialBasis),
      showControls = advancedFeatures || basis.kind !== "power";
    if (!showControls) return null;
    function chooseBasis(kind: PolynomialBasisKind) {
      const domain = suggestedDomain(xValues);
      if (kind === "power") {
        const powerSettings = { ...settings };
        delete powerSettings.polynomialBasis;
        onChange(powerSettings);
        return;
      }
      onChange({
        ...settings,
        polynomialBasis:
          kind === "taylor"
            ? { kind: "taylor", center: domain.center }
            : {
                kind: "chebyshev",
                center: domain.center,
                scale: domain.scale,
              },
      });
    }
    return (
      <div className="series-model-controls">
        <label>
          Polynomial representation
          <select
            aria-label={`${labelPrefix}Polynomial representation`}
            value={basis.kind}
            onChange={(event) =>
              chooseBasis(event.target.value as PolynomialBasisKind)
            }
          >
            <option value="power">
              Power basis · {polynomialBasisTerms(degree, "power")}
            </option>
            {(advancedFeatures || basis.kind === "taylor") && (
              <option value="taylor">
                Taylor basis · {polynomialBasisTerms(degree, "taylor")}
              </option>
            )}
            {(advancedFeatures || basis.kind === "chebyshev") && (
              <option value="chebyshev">
                Chebyshev basis · {polynomialBasisTerms(degree, "chebyshev")}
              </option>
            )}
          </select>
        </label>
        {basis.kind === "taylor" && (
          <label>
            Expansion center{xUnit ? ` [${xUnit}]` : ""}
            <EditableNumber
              aria-label={`${labelPrefix}Taylor expansion center`}
              value={basis.center}
              {...numberProps("center")}
              onChange={(center) =>
                onChange({
                  ...settings,
                  polynomialBasis: { kind: "taylor", center },
                })
              }
            />
          </label>
        )}
        {basis.kind === "chebyshev" && (
          <div className="series-fixed-values">
            <label>
              Basis center{xUnit ? ` [${xUnit}]` : ""}
              <EditableNumber
                aria-label={`${labelPrefix}Chebyshev basis center`}
                value={basis.center}
                {...numberProps("center")}
                onChange={(center) =>
                  onChange({
                    ...settings,
                    polynomialBasis: { ...basis, center },
                  })
                }
              />
            </label>
            <label>
              Basis scale{xUnit ? ` [${xUnit}]` : ""}
              <EditableNumber
                aria-label={`${labelPrefix}Chebyshev basis scale`}
                value={basis.scale}
                isValid={(value) => value > 0}
                {...numberProps("scale")}
                onChange={(scale) =>
                  onChange({
                    ...settings,
                    polynomialBasis: { ...basis, scale },
                  })
                }
              />
            </label>
          </div>
        )}
        <p className="fit-help">
          Power, Taylor, and Chebyshev forms span the same degree-{degree}
          polynomial curve space; they change the coefficient representation.
        </p>
      </div>
    );
  }

  if (settings.model !== "fourier") return null;
  const fourier = settings.fourier ?? DEFAULT_FOURIER_SETTINGS;
  function chooseHarmonics(harmonics: FourierHarmonics) {
    const oldNames = parameterNames(
        settings.model,
        settings.custom,
        settings.fourier,
      ),
      names = fourierParameterNames(harmonics);
    onChange({
      ...settings,
      fourier: { ...fourier, harmonics },
      parameters: names.map((name) => {
        const previous = oldNames.indexOf(name);
        return previous < 0
          ? { value: 0, fixed: false }
          : settings.parameters[previous];
      }),
    });
  }
  return (
    <div className="series-model-controls">
      <label>
        Harmonics
        <select
          aria-label={`${labelPrefix}Fourier harmonics`}
          value={fourier.harmonics}
          onChange={(event) =>
            chooseHarmonics(Number(event.target.value) as FourierHarmonics)
          }
        >
          {fourierHarmonicCounts.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </label>
      <div className="series-fixed-values">
        <label>
          Fixed period{xUnit ? ` [${xUnit}]` : ""}
          <EditableNumber
            aria-label={`${labelPrefix}Fourier period`}
            value={fourier.period}
            isValid={(value) => value > 0}
            {...numberProps("period")}
            onChange={(period) =>
              onChange({
                ...settings,
                fourier: { ...fourier, period },
              })
            }
          />
        </label>
        <label>
          Fixed origin{xUnit ? ` [${xUnit}]` : ""}
          <EditableNumber
            aria-label={`${labelPrefix}Fourier origin`}
            value={fourier.origin}
            {...numberProps("origin")}
            onChange={(origin) =>
              onChange({
                ...settings,
                fourier: { ...fourier, origin },
              })
            }
          />
        </label>
      </div>
    </div>
  );
}
