/** Restricted expression language: no JavaScript evaluation, properties or ambient names. */
export interface CustomEquation {
  expression: string;
  variable: string;
  names: string[];
  units: string[];
}
type Node =
  | { kind: "number"; value: number }
  | { kind: "name"; name: string }
  | { kind: "neg"; child: Node }
  | { kind: "call"; name: string; child: Node }
  | { kind: "binary"; op: string; left: Node; right: Node };
const functions: Record<
  string,
  [(x: number) => number, (x: number) => number]
> = {
  sin: [Math.sin, Math.cos],
  cos: [Math.cos, (x) => -Math.sin(x)],
  tan: [Math.tan, (x) => 1 / Math.cos(x) ** 2],
  exp: [Math.exp, Math.exp],
  ln: [Math.log, (x) => 1 / x],
  log: [Math.log10, (x) => 1 / (x * Math.LN10)],
  sqrt: [Math.sqrt, (x) => 0.5 / Math.sqrt(x)],
  asin: [Math.asin, (x) => 1 / Math.sqrt(1 - x * x)],
  acos: [Math.acos, (x) => -1 / Math.sqrt(1 - x * x)],
  atan: [Math.atan, (x) => 1 / (1 + x * x)],
  sinh: [Math.sinh, Math.cosh],
  cosh: [Math.cosh, Math.sinh],
};
const identifier = /^[A-Za-z][A-Za-z0-9_]*$/;
export function validVariable(name: string) {
  return (
    name.length <= 64 &&
    identifier.test(name) &&
    !Object.hasOwn(functions, name) &&
    !["pi", "e"].includes(name)
  );
}
function parse(expression: string) {
  if (!expression.trim() || expression.length > 1000)
    throw Error("Enter an expression of 1–1000 characters.");
  const tokens: string[] = [];
  const pattern =
    /\s*(?:(\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?|[A-Za-z][A-Za-z0-9_]*|[()+\-*/^])/y;
  let position = 0;
  while (position < expression.trimEnd().length) {
    pattern.lastIndex = position;
    const match = pattern.exec(expression);
    if (!match)
      throw Error(
        `Unexpected character at position ${position + 1}. Use explicit * for multiplication.`,
      );
    tokens.push(match[0].trim());
    position = pattern.lastIndex;
    if (tokens.length > 256)
      throw Error("Equation is too complex (maximum 256 tokens).");
  }
  let cursor = 0;
  const names: string[] = [];
  function expr(min = 0, depth = 0): Node {
    if (depth > 48) throw Error("Equation is nested too deeply.");
    const token = tokens[cursor++];
    let left: Node;
    if (token === "-" || token === "+") {
      const child = expr(3, depth + 1);
      left = token === "-" ? { kind: "neg", child } : child;
    } else if (token === "(") {
      left = expr(0, depth + 1);
      if (tokens[cursor++] !== ")") throw Error("Missing closing parenthesis.");
    } else if (token && /^\d|^\./.test(token)) {
      const value = Number(token);
      if (!Number.isFinite(value)) throw Error("Numbers must be finite.");
      left = { kind: "number", value };
    } else if (token && identifier.test(token)) {
      if (tokens[cursor] === "(") {
        if (!Object.hasOwn(functions, token))
          throw Error(`Unknown function “${token}”. Use * for multiplication.`);
        cursor++;
        left = { kind: "call", name: token, child: expr(0, depth + 1) };
        if (tokens[cursor++] !== ")")
          throw Error("Functions take one parenthesized argument.");
      } else {
        if (Object.hasOwn(functions, token))
          throw Error(`Use ${token}(...) for this function.`);
        left = { kind: "name", name: token };
        if (!names.includes(token) && !["pi", "e"].includes(token))
          names.push(token);
      }
    } else
      throw Error(
        `Expected a number, name or parenthesis${token ? `; found “${token}”` : " at the end"}.`,
      );
    while (cursor < tokens.length) {
      const op = tokens[cursor],
        priority = (
          { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 } as Record<string, number>
        )[op];
      if (!priority || priority < min) break;
      cursor++;
      left = {
        kind: "binary",
        op,
        left,
        right: expr(op === "^" ? priority : priority + 1, depth + 1),
      };
    }
    return left;
  }
  const root = expr();
  if (cursor !== tokens.length)
    throw Error(`Unexpected “${tokens[cursor]}”. Use * for multiplication.`);
  return { root, names };
}
export function inspectEquation(expression: string, variable: string) {
  if (!validVariable(variable))
    throw Error(
      "Use a variable such as x or t; function names, pi and e are reserved.",
    );
  const parsed = parse(expression);
  const names = parsed.names.filter((n) => n !== variable);
  if (names.some((n) => n.length > 64))
    throw Error("Parameter names must be at most 64 characters.");
  if (names.length < 1 || names.length > 8)
    throw Error("Use between 1 and 8 named parameters.");
  return { ...parsed, names };
}
const cache = new Map<string, ReturnType<typeof inspectEquation>>();
function compiled(def: CustomEquation) {
  const key = JSON.stringify([def.expression, def.variable]);
  let result = cache.get(key);
  if (!result) {
    result = inspectEquation(def.expression, def.variable);
    if (cache.size >= 32) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
  }
  return result;
}
export function validateEquation(def: CustomEquation) {
  const { names } = compiled(def);
  if (
    JSON.stringify(names) !== JSON.stringify(def.names) ||
    def.units.length !== names.length
  )
    throw Error(
      "Equation parameter names or units do not match the expression.",
    );
}
/** Forward-mode automatic differentiation in the physical parameter basis. */
export function customValueGradient(
  x: number,
  def: CustomEquation,
  p: readonly number[],
) {
  const zero = () => p.map(() => 0);
  function walk(node: Node): { value: number; gradient: number[] } {
    if (node.kind === "number") return { value: node.value, gradient: zero() };
    if (node.kind === "name") {
      const i = def.names.indexOf(node.name),
        gradient = zero();
      if (i >= 0) gradient[i] = 1;
      return {
        value:
          i >= 0
            ? p[i]
            : node.name === def.variable
              ? x
              : node.name === "pi"
                ? Math.PI
                : Math.E,
        gradient,
      };
    }
    if (node.kind === "neg" || node.kind === "call") {
      const a = walk(node.child);
      const [f, d] =
        node.kind === "neg"
          ? [(v: number) => -v, () => -1]
          : functions[node.name];
      return {
        value: f(a.value),
        gradient: a.gradient.map((g) => (g === 0 ? 0 : g * d(a.value))),
      };
    }
    const a = walk(node.left),
      b = walk(node.right);
    const value =
      node.op === "+"
        ? a.value + b.value
        : node.op === "-"
          ? a.value - b.value
          : node.op === "*"
            ? a.value * b.value
            : node.op === "/"
              ? a.value / b.value
              : a.value ** b.value;
    const gradient = p.map((_, i) => {
      const da = a.gradient[i],
        db = b.gradient[i];
      if (!da && !db) return 0;
      if (node.op === "+") return da + db;
      if (node.op === "-") return da - db;
      if (node.op === "*") return da * b.value + a.value * db;
      if (node.op === "/")
        return (da * b.value - a.value * db) / (b.value * b.value);
      return (
        (da === 0 || b.value === 0
          ? 0
          : da * b.value * a.value ** (b.value - 1)) +
        (db === 0 ? 0 : db * value * Math.log(a.value))
      );
    });
    return { value, gradient };
  }
  return walk(compiled(def).root);
}
/** Conservative structural test: fixed parameters count as constants. */
export function customIsLinear(def: CustomEquation, free: readonly number[]) {
  const freeNames = new Set(free.map((i) => def.names[i]));
  function degree(n: Node): number {
    if (n.kind === "number") return 0;
    if (n.kind === "name") return freeNames.has(n.name) ? 1 : 0;
    if (n.kind === "neg") return degree(n.child);
    if (n.kind === "call") return degree(n.child) === 0 ? 0 : 2;
    const a = degree(n.left),
      b = degree(n.right);
    if (n.op === "+" || n.op === "-") return Math.max(a, b);
    if (n.op === "*") return Math.min(2, a + b);
    if (n.op === "/") return b === 0 ? a : 2;
    if (a === 0 && b === 0) return 0;
    if (n.right.kind === "number" && n.right.value === 1) return a;
    return 2;
  }
  return degree(compiled(def).root) <= 1;
}
