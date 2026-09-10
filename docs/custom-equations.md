# Custom equations

Choose **Analysis → Custom equation…**, or **Edit as custom equation** beneath an existing analysis. Conversion preserves the current coefficients and fixed values; supplied shape or period values become named fixed parameters. The equation uses the numerical values in the declared axis units. Logarithmic and power-law references are one declared x-unit.

Enter the independent variable name (usually `x` or `t`) and the right-hand side only, for example `y0 + v0*t + 0.5*a*t^2`. The parameter list appears in order of first occurrence. Check the names for typos, then **Apply equation**. Names retained from the previous equation retain their values, fixed flags and units; new parameters start at 1 with unknown units. Applying changes clears acceptance of uncertainty assumptions and the old fit. Discard equation edits restores the applied equation. Fit and Save are disabled while equation edits are pending.

Use the normal parameter table for starting values, units and fixed/free controls. Names and units are case-sensitive. Blank parameter units mean unknown; `1` denotes dimensionless. Units are recorded, not algebraically checked. The independent variable is mapped to the selected X column regardless of its column heading. Angles are in radians. Function arguments must have physically appropriate units; rescale with explicit parameters when needed.

## Expression language

Decimal/scientific numbers; identifiers beginning with an ASCII letter followed by letters, digits or underscores; parentheses; `+ - * / ^`. Multiplication is explicit. Powers associate right to left: `2^3^2` is 512; `-x^2` is `-(x^2)`. Unary signs also work in exponents.

One-argument functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sinh`, `cosh`, `exp`, `ln` (natural log), `log` (base 10), `sqrt`. Constants `pi` and `e` are reserved, as are function names. No JavaScript, property access, assignment, randomness, helper functions, branches or parameter-to-parameter definitions. Limits: 1000 characters, 256 tokens, 48 nested parser levels, 1–8 parameters and 64 characters per identifier.

## Numerics and inference

A restricted syntax tree evaluates the equation and computes derivatives by forward automatic differentiation. It never executes input as code. A conservative structural check detects affine dependence on the free parameters, treating fixed parameters as constants. Those equations use weighted QR directly. Other equations use the existing scaled damped Gauss–Newton solver with QR steps and a final undamped rank check. Both preserve the exact observations and existing weighting, exclusion, covariance and assumption rules.

For nonlinear equations, starting values matter and other minima may exist. Errors and bands use a local approximation; Q is withheld. Equations that are algebraically linear but not recognized structurally may also take this conservative nonlinear path. This first version has fixed/free controls but no parameter bounds. A domain error at any included observation blocks fitting and identifies the observation; invalid trial steps are rejected. Plot segments outside the equation's real finite domain are omitted, not bridged.

The same residual plots, confidence bands, reports and print preview are used. Reports include the exact equation, independent variable, starting/fixed values and units. A custom `.trksess` stores these as session v3; it stores no fitted-result cache. See [integration compatibility](integration.md).
