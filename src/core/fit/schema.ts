import { validateEquation, type CustomEquation } from "./customEquation";
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
export const settingsV1Schema = z
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
    ]),
    parameters: z
      .array(z.object({ value: finite, fixed: z.boolean() }).strict())
      .min(2)
      .max(5),
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
  if (new Set(s.excludedIds).size !== s.excludedIds.length)
    ctx.addIssue({ code: "custom", message: "Duplicate exclusion identity" });
}

export const settingsV2Schema = settingsV1Schema
  .extend({
    model: z.enum([
      ...settingsV1Schema.shape.model.options,
      ...nonlinearModelIds,
    ]),
  })
  .superRefine(checkSettings)
  .superRefine((s, ctx) => {
    if (isNonlinearModel(s.model))
      for (const j of nonlinearModels[s.model].positive) {
        if (!(s.parameters[j]?.value > 0))
          ctx.addIssue({
            code: "custom",
            message: `${nonlinearModels[s.model].names[j]} must be positive`,
          });
      }
  });
const customSchema = z
  .object({
    expression: z.string().min(1).max(1000),
    variable: z.string().min(1).max(64),
    names: z.array(z.string().min(1).max(64)).min(1).max(8),
    units: z.array(z.string().max(100)).min(1).max(8),
  })
  .strict();
export const settingsSchema = settingsV2Schema
  .extend({
    model: z.enum([...settingsV2Schema.shape.model.options, "custom"]),
    parameters: z
      .array(z.object({ value: finite, fixed: z.boolean() }).strict())
      .min(1)
      .max(8),
    custom: customSchema.optional(),
  })
  .superRefine(checkSettings)
  .superRefine((s, ctx) => {
    try {
      if (s.model === "custom") {
        if (!s.custom) throw Error("Custom equation is required");
        validateEquation(s.custom);
      } else {
        if (s.custom)
          throw Error("Custom equation is only valid for a custom model");
        settingsV2Schema.parse(s);
      }
    } catch (error) {
      ctx.addIssue({ code: "custom", message: String(error) });
    }
  });
export const dataTableSchema = z
  .object({
    cells: z.array(z.array(z.string()).max(1000)).max(100001),
    rowIds: z.array(text).max(100001),
    headerRows: z.number().int().nonnegative(),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    sigma: z.number().int().nonnegative().nullable(),
    units: z.array(z.string()).max(1000),
  })
  .strict();
export type DataTable = z.infer<typeof dataTableSchema>;
const sessionV1Object = z
  .object({
    format: z.literal("tracker-fit-session"),
    version: z.literal(1),
    request: requestSchema,
    originalRequest: requestSchema.optional(),
    dataTable: dataTableSchema.optional(),
    settings: settingsV1Schema,
    engine: z.enum(["qr-mgs2-1", "qr-vp-sine-2"]),
  })
  .strict();
const sessionV2Object = sessionV1Object.extend({
  version: z.literal(2),
  settings: settingsV2Schema,
  engine: z.literal("qr-lm-3"),
});
const sessionV3Object = sessionV1Object.extend({
  version: z.literal(3),
  settings: settingsSchema,
  engine: z.literal("qr-expression-4"),
});
function checkSession(
  s:
    | z.infer<typeof sessionV1Object>
    | z.infer<typeof sessionV2Object>
    | z.infer<typeof sessionV3Object>,
  ctx: z.RefinementCtx,
) {
  if (s.settings.model === "sine-free-period" && s.engine === "qr-mgs2-1")
    ctx.addIssue({
      code: "custom",
      message: "Fitted-period sine requires engine qr-vp-sine-2",
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
          t.x >= row.length ||
          t.y >= row.length ||
          numericCell(row[t.x]) !== r.x ||
          numericCell(row[t.y]) !== r.y ||
          (t.sigma !== null && t.sigma >= row.length)
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
export const sessionV1Schema = sessionV1Object.superRefine(checkSession);
export const sessionV2Schema = sessionV2Object.superRefine(checkSession);
export const sessionV3Schema = sessionV3Object.superRefine(checkSession);
export const sessionSchema = z.union([
  sessionV1Schema,
  sessionV2Schema,
  sessionV3Schema,
]);
export const sessionVersion = (settings: { model: string }) =>
  settings.model === "custom"
    ? (3 as const)
    : isNonlinearModel(settings.model)
      ? (2 as const)
      : (1 as const);
export const sessionEngine = (settings: { model: string }) =>
  settings.model === "custom"
    ? ("qr-expression-4" as const)
    : isNonlinearModel(settings.model)
      ? ("qr-lm-3" as const)
      : ("qr-vp-sine-2" as const);
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
export const parameterNames = (
  model: string,
  custom?: CustomEquation,
): string[] =>
  model === "custom"
    ? (custom?.names ?? ["b", "m"])
    : {
        "exponential-decay": nonlinearModels["exponential-decay"].names,
        "power-law-free": nonlinearModels["power-law-free"].names,
        gaussian: nonlinearModels.gaussian.names,
        "damped-sine": nonlinearModels["damped-sine"].names,
        lorentzian: nonlinearModels.lorentzian.names,
        line: ["b", "m"],
        quadratic: ["c0", "c1", "c2"],
        cubic: ["c0", "c1", "c2", "c3"],
        quartic: ["c0", "c1", "c2", "c3", "c4"],
        logarithmic: ["b", "a"],
        sine: ["b", "s", "c"],
        "sine-free-period": ["b", "s", "c", "T"],
        exponential: ["b", "a"],
        "power-law": ["b", "a"],
        reciprocal: ["b", "a"],
        "constant-acceleration": ["y0", "v0", "a"],
      }[model as Exclude<FitSettings["model"], "custom">];
export function initialSettings(
  model: FitSettings["model"] = "constant-acceleration",
): FitSettings {
  return {
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
      fixed: false,
    })),
    excludedIds: [],
    conditionalInference: false,
    physicalTimeConfirmed: false,
    selectionAfterInspection: false,
  };
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
