import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  parseTracker,
  parseTrackerArchive,
  trackerAnalysis,
} from "../../src/import/tracker";
import { sessionSchema } from "../../src/core/fit/schema";
const xml = readFileSync("tests/fixtures/tracker/calibrated.trk", "utf8");
const id = "00000000-0000-4000-8000-000000000001";
describe("Tracker numerical snapshot import", () => {
  it("inverts rotated anisotropic calibration, preserves source values and missing clip steps", () => {
    const track = parseTracker(xml, "cart.trk").tracks[0];
    expect(track.name).toBe("Cart & spring");
    expect(track.rows.map((r) => r.frame)).toEqual([2, 4, 6]);
    // Forward OSP transform at 90 degrees: imageX=100-10*y; imageY=200-20*x.
    expect(track.rows[0].x).toBeCloseTo(3, 13);
    expect(track.rows[0].y).toBeCloseTo(2, 13);
    expect(track.rows[2].x).toBeCloseTo(5, 13);
    expect(track.rows[2].y).toBeCloseTo(4, 13);
    expect(track.rows[1].x).toBeNull();
    expect(track.rows[0].pixelX).toBe("80.00000000000000");
    const plain = trackerAnalysis(track, false, id);
    expect(plain.request.dataset.xColumn.label).toBe("Frame");
    expect(plain.request.dataset.rows[1]).toMatchObject({
      id: "frame-4",
      included: false,
      y: null,
    });
    expect(plain.request.uncertainty).toEqual({
      kind: "unknown-equal",
      errorStructure: "unknown",
    });
    const timed = trackerAnalysis(track, true, id);
    expect(timed.request.dataset.rows.map((r) => r.x)).toEqual([0.5, 0.7, 0.9]);
    expect(timed.request.source.context).toContain(
      "User explicitly assumed uniform timing",
    );
    expect(timed.request.dataset.xColumn.unit).toBe("s");
    expect(timed.request.dataset.yColumn.unit).toBe("m");
    const saved = sessionSchema.parse(
      JSON.parse(
        JSON.stringify({
          format: "tracker-fit-session",
          version: 1,
          ...timed,
          engine: "qr-vp-sine-2",
        }),
      ),
    );
    expect(saved.dataTable?.cells[1][3]).toBe("80.00000000000000");
    expect(track.rows[0].frame).toBe(2);
  });
  it("leaves absent units and time unspecified and accepts older version metadata", () => {
    const older = xml
      .replace(
        /<property name="(?:length_unit|semantic_version)"[^>]*>[^<]*<\/property>/g,
        "",
      )
      .replace(/<property name="delta_t"[^>]*>[^<]*<\/property>/, "");
    const track = parseTracker(older, "old.trk").tracks[0];
    const result = trackerAnalysis(track, false, id);
    expect(result.request.dataset.yColumn.unit).toBeNull();
    expect(result.request.source.version).toBe("unknown");
    expect(() => trackerAnalysis(track, true, id)).toThrow(/timing/);
  });
  it("applies time-varying coordinate keyframes as held values without interpolation", () => {
    const marker = '   <property name="[0]"';
    const start = xml.indexOf(marker),
      end =
        xml.indexOf("   </object></property>", start) +
        "   </object></property>".length;
    const next = xml
      .slice(start, end)
      .replace("[0]", "[5]")
      .replace(">100</property>", ">110</property>");
    const varying = xml.slice(0, end) + next + xml.slice(end);
    const track = parseTracker(
      varying.replace(
        'name="fixedorigin" type="boolean">true',
        'name="fixedorigin" type="boolean">false',
      ),
      "moving.trk",
    ).tracks[0];
    expect(track.rows[0].y).toBeCloseTo(2, 13);
    expect(track.rows[2].y).toBeCloseTo(5, 13);
    expect(() => parseTracker(varying, "bad.trk")).toThrow(/Inconsistent/);
  });
  it("rejects malformed, ambiguous and unsupported projects instead of guessing", () => {
    for (const bad of [
      xml.slice(0, -20),
      '<!DOCTYPE object [<!ENTITY x "secret">]>' + xml,
      xml.replace(
        'name="xscale" type="double">10',
        'name="xscale" type="double">0',
      ),
      xml.replace('name="x" type="double">60', 'name="x" type="double">NaN'),
      xml.replace("TrackerPanel", "TFrame"),
      xml.replace(
        'name="stepsize" type="int">2',
        'name="stepsize" type="int">0',
      ),
      xml.replace(
        '<property name="tracks"',
        '<property name="referenceframe" type="string">cart</property><property name="tracks"',
      ),
    ])
      expect(() => parseTracker(bad, "bad.trk")).toThrow();
  });
  it("offers multiple tracks and reports unsupported tracks explicitly", () => {
    const start = xml.indexOf('  <property name="item"'),
      end = xml.lastIndexOf(" </property>");
    const item = xml.slice(start, end);
    const mixed =
      xml.slice(0, end) +
      item.replace("Cart &amp; spring", "Second cart") +
      item.replace('tracker.PointMass"', 'tracker.AnalyticParticle"') +
      xml.slice(end);
    const result = parseTracker(mixed, "two.trk");
    expect(result.tracks).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
  });
  it("extracts only TRK entries from a TRZ without reading media or following paths", () => {
    const archive = zipSync({
      "tabs/cart.trk": strToU8(xml),
      "video.mp4": new Uint8Array([255, 0, 1]),
      "../notes.html": strToU8("ignored"),
      "bad.trk": strToU8("bad"),
    });
    const result = parseTrackerArchive(archive, "lab.trz");
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0].fileName).toBe("lab.trz / tabs/cart.trk");
    expect(result.warnings).toHaveLength(1);
    expect(() =>
      parseTrackerArchive(new Uint8Array([1, 2, 3]), "bad.trz"),
    ).toThrow();
    expect(() =>
      parseTrackerArchive(
        zipSync({ "huge.trk": new Uint8Array(20_000_001) }),
        "huge.trz",
      ),
    ).toThrow(/limit|20 MB/);
  });
});
