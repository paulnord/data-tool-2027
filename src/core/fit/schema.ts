import { validateEquation, type CustomEquation } from "./customEquation";
import { higherPolynomialIds, polynomialDegree } from "./polynomialModels";
import {
  nonlinearModelIds,
  nonlinearModels,
  isNonlinearModel,
} from "./nonlinearModels";
import { z } from "zod/v4";
const finite = z.number().finite();
const text = z.string().min(1);
const status = z.enum(["asserted", "unknown", "known-false"]);
export const assumptionsSchema = z
  .object({ exactX: status, gaussianIndependent: status, correctModel: status })
  .strict();
const provenance = z
  .object({
    kind: z.enum(["user-asserted", "instrument-calibrated", "unknown"]),
    description: text,
  })
  .strict();
const common = {
  errorStructure: z.enum(["uncorrelated", "known-correlated", "unknown"]),
};
export const perRowUncertaintySchema = z
  .object({
    ...common,
    kind: z.literal("supplied-per-row"),
    sigmaByRow: z.record(z.string(), finite.positive()),
    provenance,
  })
  .strict();
export const uncertaintySchema = z.discriminatedUnion("kind", [
  z.object({ ...common, kind: z.literal("unknown-equal") }).strict(),
  z
    .object({
      ...common,
      kind: z.literal("supplied-common"),
      sigmaY: finite.positive(),
      provenance,
    })
    .strict(),
  perRowUncertaintySchema,
]);
export const rowSchema = z
  .object({
    id: text,
    label: text.optional(),
    x: finite.nullable(),
    y: finite.nullable(),
    included: z.boolean(),
    missingReason: z
      .enum(["missing-value", "out-of-bounds", "calculation-error"])
      .nullable(),
  })
  .strict();
const column = z
  .object({ id: text, label: text, unit: text.nullable() })
  .strict();
export const requestObjectSchema = z
  .object({
    format: z.literal("tracker-fit-request"),
    version: z.literal(1),
    requestId: z.string().uuid(),
    snapshotId: z.string().uuid(),
    source: z
      .object({
        application: text,
        version: text,
        context: text.nullable(),
        fileName: text.nullable().optional(),
      })
      .strict(),
    dataset: z
      .object({
        id: text,
        label: text,
        xColumn: column,
        yColumn: column,
        assumptions: assumptionsSchema,
        rows: z.array(rowSchema).max(100000),
      })
      .strict(),
    uncertainty: uncertaintySchema,
  })
  .strict();
export const requestSchema = requestObjectSchema.superRefine((r, ctx) => {
  const ids = new Set<string>();
  r.dataset.rows.forEach((row, i) => {
    if (ids.has(row.id))
      ctx.addIssue({
        code: "custom",
        path: ["dataset", "rows", i],
        message: "Duplicate row identity",
      });
    ids.add(row.id);
    if ((row.x === null || row.y === null) !== (row.missingReason !== null))
      ctx.addIssue({
        code: "custom",
        message:
          "Missing values require a reason, and finite rows require null reason",
      });
    if ((row.x === null || row.y === null) && row.included)
      ctx.addIssue({
        code: "custom",
        message: "Missing rows cannot be included",
      });
    if (
      r.uncertainty.kind === "supplied-per-row" &&
      row.included &&
      !Object.hasOwn(r.uncertainty.sigmaByRow, row.id)
    )
      ctx.addIssue({
        code: "custom",
        message: "Included row has no supplied uncertainty",
      });
  });
  if (
    r.uncertainty.kind === "supplied-per-row" &&
    Object.keys(r.uncertainty.sigmaByRow).some((id) => !ids.has(id))
  )
    ctx.addIssue({
      code: "custom",
      message: "Uncertainty references an unknown row",
    });
  if (
    r.uncertainty.errorStructure === "known-correlated" &&
    r.dataset.assumptions.gaussianIndependent === "asserted"
  )
    ctx.addIssue({
      code: "custom",
      message: "Correlation contradicts asserted independence",
    });
});
const customSchema = z
  .object({
    expression: z.string().min(1).max(1000),
    variable: z.string().min(1).max(64),
    names: z.array(z.string().min(1).max(64)).min(1).max(8),
    units: z.array(z.string().max(100)).min(1).max(8),
  })
  .strict();
export const settingsSchema = z
  .object({
    model: z.enum([
      "line",
      "quadratic",
      "cubic",
      "quartic",
      "logarithmic",
      "sine",
      "sine-free-period",
      "exponential",
      "power-law",
      "reciprocal",
      "constant-acceleration",
      ...higherPolynomialIds,
      ...nonlinearModelIds,
      "custom",
    ]),
    parameters: z
      .array(z.object({ value: finite, fixed: z.boolean() }).strict())
      .min(1)
      .max(11),
    custom: customSchema.optional(),
    sinePeriod: finite.positive().optional(),
    periodMin: finite.positive().optional(),
    periodMax: finite.positive().optional(),
    shape: finite.optional(),
    retainedPerRowUncertainty: perRowUncertaintySchema.optional(),
    excludedIds: z.array(text),
    conditionalInference: z.boolean(),
    physicalTimeConfirmed: z.boolean(),
    selectionAfterInspection: z.boolean(),
  })
  .strict()
  .superRefine(checkSettings);
function checkSettings(
  s: {
    model: string;
    parameters: { value: number; fixed: boolean }[];
    periodMin?: number;
    periodMax?: number;
    excludedIds: string[];
    custom?: CustomEquation;
  },
  ctx: z.RefinementCtx,
) {
  if (s.parameters.length !== parameterNames(s.model, s.custom).length)
    ctx.addIssue({
      code: "custom",
      message: "Parameter count does not match model",
    });
  if (
    s.model === "sine-free-period" &&
    (!(s.periodMin! > 0) || !(s.periodMax! > s.periodMin!))
  )
    ctx.addIssue({
      code: "custom",
      message: "Sine search requires positive ordered period bounds",
    });
  if (s.model === "sine-free-period" && !(s.parameters[3]?.value > 0))
    ctx.addIssue({ code: "custom", message: "Period must be positive" });
  if (isNonlinearModel(s.model))
    for (const j of nonlinearModels[s.model].positive)
      if (!(s.parameters[j]?.value > 0))
        ctx.addIssue({
          code: "custom",
          message: `${nonlinearModels[s.model].names[j]} must be positive`,
        });
  try {
    if (s.model === "custom") {
      if (!s.custom) throw Error("Custom equation is required");
      validateEquation(s.custom);
    } else if (s.custom)
      throw Error("Custom equation is only valid for a custom model");
  } catch (error) {
    ctx.addIssue({ code: "custom", message: String(error) });
  }
  if (new Set(s.excludedIds).size !== s.excludedIds.length)
    ctx.addIssue({ code: "custom", message: "Duplicate exclusion identity" });
}

export const dataTableSchema = z
  .object({
    cells: z.array(z.array(z.string()).max(1000)).max(100001),
    rowIds: z.array(text).max(100001),
    headerRows: z.number().int().nonnegative(),
    label: z.number().int().nonnegative().nullable().optional(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    sigma: z.number().int().nonnegative().nullable(),
    units: z.array(z.string()).max(1000),
  })
  .strict();
export type DataTable = z.infer<typeof dataTableSchema>;
const analysisObjectSchema = z
  .object({
    request: requestSchema,
    originalRequest: requestSchema.optional(),
    dataTable: dataTableSchema.optional(),
    settings: settingsSchema,
    engine: z.enum(["qr-vp-sine-2", "qr-lm-3", "qr-expression-4"]),
  })
  .strict();
function checkAnalysis(
  s: z.infer<typeof analysisObjectSchema>,
  ctx: z.RefinementCtx,
) {
  if (s.engine !== sessionEngine(s.settings))
    ctx.addIssue({
      code: "custom",
      message: "Session engine does not match model",
    });
  if (s.settings.retainedPerRowUncertainty) {
    const retained = requestSchema.safeParse({
      ...s.request,
      uncertainty: s.settings.retainedPerRowUncertainty,
    });
    if (!retained.success)
      for (const issue of retained.error.issues)
        ctx.addIssue({
          code: "custom",
          path: ["settings", "retainedPerRowUncertainty"],
          message: issue.message,
        });
  }
  if (s.dataTable) {
    const t = s.dataTable;
    const rows = t.cells.slice(t.headerRows);
    let valid =
      t.headerRows <= t.cells.length &&
      t.rowIds.length === t.cells.length &&
      new Set(t.rowIds).size === t.rowIds.length &&
      rows.length === s.request.dataset.rows.length &&
      (t.label == null ||
        (t.label !== t.x && t.label !== t.y && t.label !== t.sigma)) &&
      t.x !== t.y &&
      t.sigma !== t.x &&
      t.sigma !== t.y;
    if (
      (t.units[t.x]?.trim() || null) !== s.request.dataset.xColumn.unit ||
      (t.units[t.y]?.trim() || null) !== s.request.dataset.yColumn.unit
    )
      valid = false;
    const supplied =
      s.request.uncertainty.kind === "supplied-per-row"
        ? s.request.uncertainty
        : s.settings.retainedPerRowUncertainty;
    try {
      rows.forEach((row, i) => {
        const r = s.request.dataset.rows[i];
        if (
          !r ||
          r.id !== t.rowIds[i + t.headerRows] ||
          (t.label != null && t.label >= row.length) ||
          t.x >= row.length ||
          t.y >= row.length ||
          numericCell(row[t.x]) !== r.x ||
          numericCell(row[t.y]) !== r.y ||
          (t.sigma !== null && t.sigma >= row.length)
        )
          valid = false;
        if (
          (t.label == null ? undefined : row[t.label]?.trim() || undefined) !==
          r?.label
        )
          valid = false;
        if (t.sigma !== null) {
          const sigma = numericCell(row[t.sigma]);
          if (
            (sigma !== null && sigma <= 0) ||
            (sigma === null && r?.x !== null && r?.y !== null)
          )
            valid = false;
          if (supplied && sigma !== (supplied.sigmaByRow[r.id] ?? null))
            valid = false;
        }
      });
    } catch {
      valid = false;
    }
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["dataTable"],
        message: "Source table does not match the current analysis rows",
      });
  }
  const ids = new Set(s.request.dataset.rows.map((r) => r.id));
  if (s.settings.excludedIds.some((id) => !ids.has(id)))
    ctx.addIssue({
      code: "custom",
      message: "Exclusion references an unknown row",
    });
}
/** An analysis has no file envelope; candidates use the same validated inputs. */
export const analysisSchema = analysisObjectSchema.superRefine(checkAnalysis);
export type FitAnalysis = z.infer<typeof analysisSchema>;
const axisRangeSchema = z
  .tuple([finite, finite])
  .refine(([lo, hi]) => lo < hi, "Range minimum must be below maximum");
const columnIndexSchema = z.number().int().nonnegative();
const workspaceDisplaySchema = z
  .object({
    xRange: axisRangeSchema.nullable(),
    yRanges: z.array(axisRangeSchema.nullable()).min(1).max(4),
    includeDetails: z.boolean(),
  })
  .strict();
const workspaceUncertainty = {
  uncertainty: z.enum(["estimate", "supplied"]),
  sigmas: z.array(finite.positive().nullable()).min(1).max(4),
  conditional: z.boolean(),
};
export const multiIntervalWorkspaceSchema = workspaceDisplaySchema.extend({
  kind: z.literal("multi-interval"),
  x: columnIndexSchema,
  columns: z.array(columnIndexSchema).min(1).max(4),
  ...workspaceUncertainty,
  intervals: z
    .array(
      z
        .object({
          name: text.refine(
            (s) => !!s.trim(),
            "Interval name must not be blank",
          ),
          range: axisRangeSchema.nullable(),
          settings: z.array(settingsSchema).min(1).max(4),
        })
        .strict(),
    )
    .min(1)
    .max(5),
  intervalCount: z.number().int().min(1).max(5),
  activeInterval: columnIndexSchema,
  activeCurve: columnIndexSchema,
});
export const comparisonWorkspaceSchema = z
  .object({
    kind: z.literal("model-comparison"),
    candidates: z
      .array(
        z
          .object({
            label: text,
            analysis: analysisSchema,
          })
          .strict(),
      )
      .min(2)
      .max(6),
    activeCandidate: columnIndexSchema,
  })
  .strict();
export const collisionWorkspaceSchema = workspaceDisplaySchema.extend({
  kind: z.literal("collision"),
  time: columnIndexSchema,
  columns: z.array(columnIndexSchema).length(4),
  ...workspaceUncertainty,
  before: axisRangeSchema,
  after: axisRangeSchema,
  details: z.boolean(),
});
export const workspaceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("single-fit") }).strict(),
  multiIntervalWorkspaceSchema,
  comparisonWorkspaceSchema,
  collisionWorkspaceSchema,
]);
export type MultiIntervalWorkspace = z.infer<
  typeof multiIntervalWorkspaceSchema
>;
export type ComparisonWorkspace = z.infer<typeof comparisonWorkspaceSchema>;
export type CollisionWorkspace = z.infer<typeof collisionWorkspaceSchema>;
export type FitWorkspace = z.infer<typeof workspaceSchema>;
export const workspaceViewSchema = z
  .object({
    showResiduals: z.boolean(),
    showGuides: z.boolean(),
    showErrorBars: z.boolean(),
  })
  .strict();
export const SESSION_VERSION = 7 as const;
const sessionObjectSchema = analysisObjectSchema.extend({
  format: z.literal("tracker-fit-session"),
  version: z.literal(SESSION_VERSION, {
    error:
      "Unsupported session version. This build opens session version 7 only.",
  }),
  workspace: workspaceSchema,
  view: workspaceViewSchema,
});
/** One current file format for every equation and analysis workspace. */
export const sessionSchema = sessionObjectSchema.superRefine((s, ctx) => {
  checkAnalysis(s, ctx);
  const w = s.workspace;
  const fail = (message: string) =>
    ctx.addIssue({ code: "custom", path: ["workspace"], message });
  if (w.kind === "single-fit") return;
  if (!s.dataTable) {
    fail("A multi-fit workspace requires its source table");
    return;
  }
  if (w.kind === "model-comparison") {
    if (w.activeCandidate >= w.candidates.length)
      fail("Active candidate is out of range");
    return;
  }
  const x = w.kind === "multi-interval" ? w.x : w.time;
  const selected = [x, ...w.columns];
  const width = s.dataTable.cells.reduce(
    (n, row) => Math.max(n, row.length),
    0,
  );
  if (
    new Set(selected).size !== selected.length ||
    selected.some((i) => i >= width)
  )
    fail("Workspace requires distinct, available X and Y columns");
  try {
    for (const row of s.dataTable.cells.slice(s.dataTable.headerRows))
      for (const i of selected) numericCell(row[i] ?? "");
  } catch {
    fail(
      "Selected workspace columns must contain finite numbers or missing values",
    );
  }
  if (
    w.sigmas.length !== w.columns.length ||
    w.yRanges.length !== w.columns.length
  )
    fail("Each data series requires an uncertainty entry and a display range");
  if (w.uncertainty === "supplied" && w.sigmas.some((v) => v === null))
    fail("Enter a positive uncertainty for every data series");
  if (w.kind === "collision") {
    if (w.before[1] >= w.after[0])
      fail("Collision intervals must be separated and ordered");
    return;
  }
  if (
    w.intervalCount > w.intervals.length ||
    w.activeInterval >= w.intervalCount ||
    w.activeCurve >= w.columns.length
  )
    fail("Active interval or data series is out of range");
  const ids = new Set(s.request.dataset.rows.map((r) => r.id));
  for (const interval of w.intervals) {
    if (interval.settings.length !== w.columns.length)
      fail("Every interval requires settings for each data series");
    for (const settings of interval.settings) {
      if (settings.excludedIds.some((id) => !ids.has(id)))
        fail("Interval exclusion references an unknown row");
      const first = interval.settings[0];
      if (
        settings.model !== first.model ||
        settings.custom?.expression !== first.custom?.expression ||
        settings.custom?.variable !== first.custom?.variable
      )
        fail("Data series in an interval must share an equation");
    }
  }
});
export const sessionEngine = (settings: { model: string }) =>
  settings.model === "custom"
    ? ("qr-expression-4" as const)
    : isNonlinearModel(settings.model)
      ? ("qr-lm-3" as const)
      : ("qr-vp-sine-2" as const);
/** Construct a current session; file import itself never fills missing fields. */
export function createSession(
  analysis: Omit<FitAnalysis, "engine">,
  workspace: FitWorkspace = { kind: "single-fit" },
  view: z.infer<typeof workspaceViewSchema> = {
    showResiduals: true,
    showGuides: false,
    showErrorBars: true,
  },
): FitSession {
  return sessionSchema.parse({
    format: "tracker-fit-session",
    version: SESSION_VERSION,
    request: analysis.request,
    settings: analysis.settings,
    ...(analysis.originalRequest
      ? { originalRequest: analysis.originalRequest }
      : {}),
    ...(analysis.dataTable ? { dataTable: analysis.dataTable } : {}),
    engine: sessionEngine(analysis.settings),
    workspace,
    view,
  });
}
export const acknowledgmentSchema = z.discriminatedUnion("status", [
  z
    .object({
      format: z.literal("tracker-fit-ack"),
      version: z.literal(1),
      requestId: z.string().uuid(),
      status: z.literal("accepted"),
    })
    .strict(),
  z
    .object({
      format: z.literal("tracker-fit-ack"),
      version: z.literal(1),
      requestId: z.string().uuid(),
      status: z.literal("error"),
      message: text,
    })
    .strict(),
]);
export type FitRequest = z.infer<typeof requestSchema>;
export type FitSettings = z.infer<typeof settingsSchema>;
export type FitSession = z.infer<typeof sessionSchema>;
const basisParameterNames: Record<string, string[]> = {
  line: ["b", "m"],
  logarithmic: ["b", "a"],
  sine: ["b", "s", "c"],
  "sine-free-period": ["b", "s", "c", "T"],
  exponential: ["b", "a"],
  "power-law": ["b", "a"],
  reciprocal: ["b", "a"],
  "constant-acceleration": ["y0", "v0", "a"],
};
export function parameterNames(
  model: string,
  custom?: CustomEquation,
): string[] {
  if (model === "custom") return custom?.names ?? ["b", "m"];
  const degree = polynomialDegree(model);
  if (degree !== undefined)
    return Array.from({ length: degree + 1 }, (_, i) => `c${i}`);
  if (isNonlinearModel(model)) return nonlinearModels[model].names;
  return basisParameterNames[model] ?? [];
}
export function initialSettings(
  model: FitSettings["model"] = "constant-acceleration",
): FitSettings {
  return settingsSchema.parse({
    model,
    ...(model === "custom"
      ? {
          custom: {
            expression: "b + m*x",
            variable: "x",
            names: ["b", "m"],
            units: ["", ""],
          },
        }
      : {}),
    ...(model === "sine" ? { sinePeriod: 2 * Math.PI } : {}),
    ...(model === "sine-free-period" ? { periodMin: 0.2, periodMax: 20 } : {}),
    ...(model === "exponential"
      ? { shape: -1 }
      : model === "power-law"
        ? { shape: 2 }
        : {}),
    parameters: parameterNames(model).map((_, i) => ({
      value: isNonlinearModel(model)
        ? nonlinearModels[model].defaults[i]
        : model === "sine-free-period" && i === 3
          ? 3
          : 0,
      fixed: model === "gaussian-shape" && i >= 4,
    })),
    excludedIds: [],
    conditionalInference: false,
    physicalTimeConfirmed: false,
    selectionAfterInspection: false,
  });
}

/** Decimal/scientific notation only; blanks mean missing, never zero. */
export function numericCell(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  if (
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ||
    !Number.isFinite(Number(value))
  )
    throw new Error(`Not a finite decimal number: ${value}`);
  return Number(value);
}
