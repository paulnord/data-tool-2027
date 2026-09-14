/** Keep solver diagnostics intact while explaining fitting failures to users. */
export function FitErrorMessage({ message }: { message: string }) {
  const detail = message.indexOf("\nDetails: ");
  if (detail >= 0)
    return (
      <>
        <div>{message.slice(0, detail)}</div>
        <details className="fit-error-details">
          <summary>Details</summary>
          <div>{message.slice(detail + 10)}</div>
        </details>
      </>
    );
  const rank =
    /Rank deficient: (?:at most )?\d+ independent columns for (\d+) free parameters/.exec(
      message,
    );
  if (!rank) return <>{message}</>;
  const count = Number(rank[1]);
  const words = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
  ];
  return (
    <>
      <div>
        {count === 1
          ? "These data cannot determine the free parameter."
          : `These data cannot determine all ${words[count] ?? count} free parameters independently.`}
      </div>
      <div>
        Try fixing one parameter, simplifying the equation, or using data over a
        wider range.
      </div>
      <details className="fit-error-details">
        <summary>Details</summary>
        <div>{message}</div>
      </details>
    </>
  );
}
