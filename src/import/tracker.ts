import { XMLParser, XMLValidator } from "fast-xml-parser";
import { unzipSync } from "fflate";
import { ENGINE } from "../core/fit/solve";
import { analysisFromTable } from "../core/fit/dataTable";
import { sessionSchema, type DataTable } from "../core/fit/schema";

const TRACKER = "org.opensourcephysics.cabrillo.tracker.";
const MEDIA = "org.opensourcephysics.media.core.";
const LIMIT = 20_000_000;
type Node = {
  "@_name"?: string;
  "@_class"?: string;
  "#text"?: string;
  property?: Node[];
  object?: Node;
};
function property(node: Node | undefined, name: string): Node | undefined {
  const found = node?.property?.filter((p) => p["@_name"] === name) ?? [];
  if (found.length > 1) throw Error(`Duplicate Tracker property: ${name}`);
  return found[0];
}
function value(node: Node | undefined, name: string): string | undefined {
  return property(node, name)?.["#text"];
}
function object(node: Node | undefined, name: string): Node {
  const result = property(node, name)?.object;
  if (!result || Array.isArray(result))
    throw Error(`Missing or invalid Tracker ${name}`);
  return result;
}
function finite(value: string | undefined, name: string): number {
  if (
    value === undefined ||
    !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) ||
    !Number.isFinite(Number(value))
  )
    throw Error(`Missing or invalid Tracker ${name}`);
  return Number(value);
}
function number(node: Node, name: string): number {
  return finite(value(node, name), name);
}
function integer(node: Node, name: string, minimum: number): number {
  const n = number(node, name);
  if (!Number.isSafeInteger(n) || n < minimum || n > 1_000_000)
    throw Error(`Invalid Tracker ${name}`);
  return n;
}
function frames(node: Node): [number, Node][] {
  const seen = new Set<number>();
  return (property(node, "framedata")?.property ?? [])
    .map((p): [number, Node] => {
      const match = /^\[(\d+)\]$/.exec(p["@_name"] ?? "");
      const n = match ? Number(match[1]) : -1;
      if (
        n < 0 ||
        n > 1_000_000 ||
        seen.has(n) ||
        !p.object ||
        Array.isArray(p.object)
      )
        throw Error("Invalid or duplicate Tracker frame data");
      seen.add(n);
      return [n, p.object];
    })
    .sort((a, b) => a[0] - b[0]);
}
export type TrackerTrack = {
  name: string;
  fileName: string;
  version: string | null;
  lengthUnit: string;
  start: number;
  startTime: number | null;
  interval: number | null;
  notes: string[];
  rows: {
    frame: number;
    pixelX: string;
    pixelY: string;
    x: number | null;
    y: number | null;
  }[];
};
export type TrackerProject = { tracks: TrackerTrack[]; warnings: string[] };

/** Read numerical snapshots only. Never resolve video paths or instantiate saved Java classes. */
export function parseTracker(text: string, fileName: string): TrackerProject {
  if (text.length > LIMIT) throw Error("Tracker XML exceeds 20 MB limit");
  // OSP files need no DTD or custom entities. Reject declarations before parsing.
  if (/<!\s*(?:DOCTYPE|ENTITY)/i.test(text))
    throw Error(
      "Tracker XML declarations are unsupported; export data from Tracker",
    );
  const valid = XMLValidator.validate(text);
  if (valid !== true) throw Error(`Malformed Tracker XML: ${valid.err.msg}`);
  const root: Node = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    alwaysCreateTextNode: true,
    isArray: (name) => name === "property",
  }).parse(text).object;
  if (
    !root ||
    Array.isArray(root) ||
    root["@_class"] !== TRACKER + "TrackerPanel"
  )
    throw Error(
      "Expected a Tracker tab; tabsets must be opened as individual .trk files",
    );
  if (property(root, "referenceframe"))
    throw Error("Moving reference frames require a data export from Tracker");
  const coords = object(root, "coords");
  if (coords["@_class"] !== MEDIA + "ImageCoordSystem")
    throw Error("Unsupported Tracker coordinate system");
  const calibration = frames(coords).map(([frame, c]) => ({
    frame,
    xo: number(c, "xorigin"),
    yo: number(c, "yorigin"),
    angle: (number(c, "angle") * Math.PI) / 180,
    sx: number(c, "xscale"),
    sy: number(c, "yscale"),
  }));
  if (
    !calibration.length ||
    calibration[0].frame !== 0 ||
    calibration.some((c) => c.sx <= 0 || c.sy <= 0)
  )
    throw Error("Missing or invalid Tracker calibration");
  const fixed = ["fixedorigin", "fixedangle", "fixedscale"].map((name) => {
    const flag = value(coords, name);
    if (flag !== "true" && flag !== "false")
      throw Error(`Missing Tracker ${name}`);
    return flag === "true";
  });
  // Inconsistent fixed calibration is ambiguous; do not guess which keyframe wins.
  if (
    calibration.some(
      (c) =>
        (fixed[0] &&
          (c.xo !== calibration[0].xo || c.yo !== calibration[0].yo)) ||
        (fixed[1] && c.angle !== calibration[0].angle) ||
        (fixed[2] &&
          (c.sx !== calibration[0].sx || c.sy !== calibration[0].sy)),
    )
  )
    throw Error("Inconsistent fixed Tracker calibration");
  const clip = object(root, "videoclip");
  const start = integer(clip, "startframe", 0),
    step = integer(clip, "stepsize", 1),
    count = integer(clip, "stepcount", 1);
  if (count > 100000 || start + (count - 1) * step > 1_000_000)
    throw Error("Tracker clip exceeds row or frame limits");
  const control = property(root, "clipcontrol")?.object;
  const dt = value(control, "delta_t");
  const interval =
    dt === undefined || dt.trim() === "NaN" ? null : finite(dt, "delta_t");
  if (interval !== null && interval <= 0)
    throw Error("Tracker frame interval must be positive");
  const t0 = value(clip, "starttime");
  const startTime =
    t0 === undefined ? null : t0.trim() === "NaN" ? 0 : finite(t0, "starttime");
  const warnings: string[] = [];
  const tracks: TrackerTrack[] = [];
  const objects = property(root, "tracks")?.property ?? [];
  if (objects.some((p) => value(p.object, "use_data_time") === "true"))
    throw Error("External track timing requires a data export from Tracker");
  for (const [index, item] of objects.entries()) {
    const track = item.object;
    if (track?.["@_class"] !== TRACKER + "PointMass") {
      if (track && track["@_class"] !== TRACKER + "CoordAxes")
        warnings.push(
          `${value(track, "name") ?? track["@_class"]}: not a saved point-mass track; omitted.`,
        );
      continue;
    }
    const name = value(track, "name")?.trim() || `Track ${index + 1}`;
    try {
      const points = new Map(frames(track));
      if (!points.size) throw Error("No saved positions");
      let calibrationIndex = 0;
      const rows = Array.from({ length: count }, (_, i) => {
        const frame = start + i * step;
        while (
          calibrationIndex + 1 < calibration.length &&
          calibration[calibrationIndex + 1].frame <= frame
        )
          calibrationIndex++;
        const c = calibration[calibrationIndex],
          p = points.get(frame);
        if (!p) return { frame, pixelX: "", pixelY: "", x: null, y: null };
        const px = number(p, "x"),
          py = number(p, "y");
        // Inverse of OSP ImageCoordSystem.updateTransforms; image Y points down.
        const dx = (px - c.xo) / c.sx,
          dy = (py - c.yo) / c.sy;
        const x = Math.cos(c.angle) * dx - Math.sin(c.angle) * dy;
        const y = -Math.sin(c.angle) * dx - Math.cos(c.angle) * dy;
        if (!Number.isFinite(x) || !Number.isFinite(y))
          throw Error("Calibrated position overflow");
        return { frame, pixelX: value(p, "x")!, pixelY: value(p, "y")!, x, y };
      });
      if (rows.every((r) => r.x === null))
        throw Error("No saved positions inside the selected clip");
      tracks.push({
        name,
        fileName,
        version: value(root, "semantic_version") ?? null,
        lengthUnit: value(root, "length_unit")?.trim() ?? "",
        start,
        startTime,
        interval,
        rows,
        notes: [
          "Calibrated analysis inputs from saved Tracker point positions; source pixel coordinates retained. Missing steps remain missing; saved interpolated positions may be present. No velocity, acceleration, custom functions or video are evaluated.",
          `Saved coordinate keyframes: ${JSON.stringify(calibration)}. Angles recorded here in radians.`,
          `Clip start=${start}, step=${step}, count=${count}.`,
        ],
      });
    } catch (error) {
      warnings.push(`${name}: ${(error as Error).message}; omitted.`);
    }
  }
  if (!tracks.length)
    throw Error(
      `No supported point-mass data. ${warnings.join(" ")} Export a data table from Tracker.`,
    );
  return { tracks, warnings };
}

/** TRZ is a ZIP container; extract only bounded TRK entries, never media or paths to disk. */
export function parseTrackerArchive(
  bytes: Uint8Array,
  fileName: string,
): TrackerProject {
  if (bytes.length > 100_000_000)
    throw Error("Tracker archive exceeds 100 MB limit");
  let total = 0,
    count = 0;
  const entries = unzipSync(bytes, {
    filter: (entry) => {
      if (!/\.trk$/i.test(entry.name)) return false;
      total += entry.originalSize;
      if (++count > 100 || total > LIMIT)
        throw Error("Tracker archive exceeds 100 tabs or 20 MB of XML");
      return true;
    },
  });
  const project: TrackerProject = { tracks: [], warnings: [] };
  for (const [name, data] of Object.entries(entries)) {
    try {
      const parsed = parseTracker(
        new TextDecoder("utf-8", { fatal: true }).decode(data),
        `${fileName} / ${name}`,
      );
      project.tracks.push(...parsed.tracks);
      project.warnings.push(...parsed.warnings);
    } catch (error) {
      project.warnings.push(`${name}: ${(error as Error).message}`);
    }
  }
  if (!project.tracks.length)
    throw Error(
      `No supported Tracker tabs in archive. ${project.warnings.join(" ")}`,
    );
  return project;
}

export function trackerAnalysis(
  track: TrackerTrack,
  uniformTiming: boolean,
  id: string,
) {
  if (uniformTiming && (track.interval === null || track.startTime === null))
    throw Error("No saved timing available");
  const heading = [
    "Frame",
    "x",
    "y",
    "Image x",
    "Image y",
    ...(uniformTiming ? ["Time"] : []),
  ];
  const table: DataTable = {
    cells: [
      heading,
      ...track.rows.map((r) => [
        String(r.frame),
        r.x === null ? "" : String(r.x),
        r.y === null ? "" : String(r.y),
        r.pixelX,
        r.pixelY,
        ...(uniformTiming
          ? [
              String(
                (track.startTime! + (r.frame - track.start) * track.interval!) /
                  1000,
              ),
            ]
          : []),
      ]),
    ],
    rowIds: [`heading-${id}`, ...track.rows.map((r) => `frame-${r.frame}`)],
    headerRows: 1,
    x: uniformTiming ? 5 : 0,
    y: 2,
    sigma: null,
    units: [
      "",
      track.lengthUnit,
      track.lengthUnit,
      "px",
      "px",
      ...(uniformTiming ? ["s"] : []),
    ],
  };
  const analysis = analysisFromTable(
    table,
    track.name,
    undefined,
    track.fileName,
  );
  const request = {
    ...analysis.request,
    requestId: id,
    snapshotId: id,
    dataset: { ...analysis.request.dataset, id },
    source: {
      application: "Tracker project import",
      version: track.version || "unknown",
      fileName: track.fileName,
      context: [
        ...track.notes,
        uniformTiming
          ? `User explicitly assumed uniform timing: saved mean frame interval ${track.interval} ms; start time ${track.startTime} ms. Video timestamps were not reconstructed.`
          : "Frame number is the independent variable. Physical time was not reconstructed from video.",
      ].join("\n"),
    },
  };
  const validated = sessionSchema.parse({
    format: "tracker-fit-session",
    version: 1,
    ...analysis,
    request,
    engine: ENGINE,
  });
  return {
    request: validated.request,
    settings: validated.settings,
    dataTable: validated.dataTable,
  };
}
