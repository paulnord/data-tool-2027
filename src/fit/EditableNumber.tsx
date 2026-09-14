import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";

type EditableNumberProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "type" | "onChange" | "onBlur" | "onKeyDown"
> & {
  value: number;
  onChange: (value: number) => void;
  onInvalidChange: (invalid: boolean) => void;
  onRestoreInvalid: () => void;
  isValid?: (value: number) => boolean;
};

function decimalNumber(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Preserve incomplete typing while committing only finite decimal numbers. */
export function EditableNumber({
  value,
  onChange,
  onInvalidChange,
  onRestoreInvalid,
  isValid,
  ...inputProps
}: EditableNumberProps) {
  const [draft, setDraft] = useState<{ value: number; text: string } | null>(
    null,
  );
  const reportedInvalid = useRef(false),
    invalidCallback = useRef(onInvalidChange);
  function parsedNumber(text: string): number | null {
    const parsed = decimalNumber(text);
    return parsed !== null && (!isValid || isValid(parsed)) ? parsed : null;
  }
  const currentDraft = draft?.value === value ? draft : null,
    invalid = currentDraft !== null && parsedNumber(currentDraft.text) === null;

  function reportInvalid(next: boolean) {
    if (reportedInvalid.current === next) return;
    reportedInvalid.current = next;
    onInvalidChange(next);
  }

  useEffect(() => {
    invalidCallback.current = onInvalidChange;
  }, [onInvalidChange]);

  // Undo, model changes, and other external updates replace any pending draft.
  useEffect(() => {
    if (draft && draft.value !== value) setDraft(null);
    if (reportedInvalid.current !== invalid) {
      reportedInvalid.current = invalid;
      invalidCallback.current(invalid);
    }
  }, [draft, value, invalid]);

  useEffect(
    () => () => {
      if (reportedInvalid.current) invalidCallback.current(false);
    },
    [],
  );

  function restore() {
    setDraft(null);
    reportInvalid(false);
  }

  return (
    <input
      {...inputProps}
      type="text"
      inputMode="decimal"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      value={currentDraft?.text ?? String(value)}
      aria-invalid={invalid || inputProps["aria-invalid"]}
      onChange={(event) => {
        const text = event.target.value,
          parsed = parsedNumber(text);
        setDraft({ value: parsed ?? value, text });
        reportInvalid(parsed === null);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => {
        restore();
        if (invalid) onRestoreInvalid();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.blur();
          return;
        }
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        restore();
      }}
    />
  );
}
