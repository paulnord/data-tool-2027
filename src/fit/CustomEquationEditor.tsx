import { useEffect, useState } from "react";
import {
  inspectEquation,
  type CustomEquation,
} from "../core/fit/customEquation";
export type EquationDraft = Pick<CustomEquation, "expression" | "variable">;
export function CustomEquationEditor({
  definition,
  onApply,
  onPending,
  draft,
  onDraftChange,
}: {
  definition: CustomEquation;
  onApply: (definition: CustomEquation) => void;
  onPending: (pending: boolean) => void;
  draft?: EquationDraft;
  onDraftChange?: (draft: EquationDraft) => void;
}) {
  const [localExpression, setExpression] = useState(definition.expression);
  const [localVariable, setVariable] = useState(definition.variable);
  const expression = draft?.expression ?? localExpression;
  const variable = draft?.variable ?? localVariable;
  useEffect(() => {
    setExpression(definition.expression);
    setVariable(definition.variable);
    onPending(
      !!draft &&
        (draft.expression !== definition.expression ||
          draft.variable !== definition.variable),
    );
  }, [definition.expression, definition.variable, onPending]);
  const changed =
    expression !== definition.expression || variable !== definition.variable;
  let names: string[] = [],
    error = "";
  try {
    names = inspectEquation(expression, variable).names;
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="custom-equation-editor">
      <label>
        Independent variable
        <input
          aria-label="Equation variable"
          value={variable}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setVariable(e.target.value);
            onDraftChange?.({ expression, variable: e.target.value });
            onPending(
              e.target.value !== definition.variable ||
                expression !== definition.expression,
            );
          }}
        />
      </label>
      <label>
        y =
        <textarea
          aria-label="Custom equation"
          value={expression}
          rows={2}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => {
            setExpression(e.target.value);
            onDraftChange?.({ expression: e.target.value, variable });
            onPending(
              e.target.value !== definition.expression ||
                variable !== definition.variable,
            );
          }}
        />
      </label>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <p>
          Parameters: <strong>{names.join(", ")}</strong>. Check these names for
          typing errors.
        </p>
      )}
      {changed && (
        <>
          <button
            disabled={!!error}
            onClick={() =>
              onApply({
                expression,
                variable,
                names,
                units: names.map(
                  (n) => definition.units[definition.names.indexOf(n)] ?? "",
                ),
              })
            }
          >
            Apply equation
          </button>
          <button
            onClick={() => {
              setExpression(definition.expression);
              setVariable(definition.variable);
              onDraftChange?.({
                expression: definition.expression,
                variable: definition.variable,
              });
              onPending(false);
            }}
          >
            Discard equation edits
          </button>
          <p>
            Apply or discard these edits to use this equation in fits and
            reports.
          </p>
        </>
      )}
      <details>
        <summary>Equation syntax</summary>
        <p>
          Enter the right-hand side only. Use * for multiplication and ^ for
          powers; for example y0 + v0*t + 0.5*a*t^2 with variable t. Names are
          case-sensitive.
        </p>
        <p>
          Functions: sin, cos, tan, asin, acos, atan, sinh, cosh, exp, ln
          (natural log), log (base 10), sqrt. Angles are in radians. Constants:
          pi and e.
        </p>
        <p>
          Supply starting values and units below. Units are recorded as typed;
          dimensional consistency is your responsibility. Nonlinear fits may
          depend on starting values.
        </p>
      </details>
    </div>
  );
}
