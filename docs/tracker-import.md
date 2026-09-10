# Importing Tracker projects

Use **Open…** in Data Tool to select a `.trk` tab or `.trz` project, then choose a saved point-mass track and **Review data**. The normal data editor lets you choose columns and units before **Use these data** replaces the analysis. Cancelling or rejecting an import preserves the current analysis. Nothing is written to the Tracker project or extracted to disk.

The first implementation imports saved `PointMass` position tracks. It reads the clip start, step size and step count and applies the saved `ImageCoordSystem` origin, angle and scale. Fixed calibration and changing calibration keyframes are supported. Keyframe values are held until the next keyframe, following OSP's loader. Unequal x/y pixel scales and image-Y inversion are handled explicitly.

The table retains frame number, calibrated x/y, and original image x/y text. Missing clip steps remain blank and excluded from fitting. Saved positions may include Tracker-interpolated steps; the importer does not classify them as newly measured observations or interpolate missing steps itself. Only the selected clip steps enter the table. Absent length units remain unspecified. Uncertainty and inference assumptions remain unknown.

## Time

Frame number is the initial independent variable. The importer does not decode video or reconstruct video timestamps. If a saved mean frame interval and start time are present, the review offers an explicit **uniform timing** assumption. Accepting it adds a Time column in seconds and selects it for fitting:

`t = (savedStartTime + (frame - startFrame) * savedDeltaT) / 1000`

Tracker stores those timing settings in milliseconds. The assumption and the original settings are retained in session provenance. This approximation is inappropriate for variable-rate video or externally supplied time data; export Tracker's full-precision data table when exact timing is required. Without that choice, no physical time is inferred.

## Scope and limits

- `.trz` archives offer tracks from each supported embedded `.trk`; media and supporting documents are ignored. Archive entries are never interpreted as filesystem destinations.
- Saved point-mass tracks are supported. Model tracks, derived tracks, custom expressions, velocity, acceleration and other track types are not evaluated. Omitted tracks/tabs are listed for review.
- Moving reference frames and external track timing require a Tracker data export. Tabsets must be opened as individual tabs. XML DTD/entity declarations are rejected, and no external resources are resolved.
- Invalid calibration, malformed numbers, duplicate frame indices and ambiguous fixed calibration are rejected. A valid track in a mixed project remains available, with explicit warnings about omitted items.
- Text inputs are limited to 20 MB. Archives are limited to 100 MB, 100 embedded tabs and 20 MB total extracted XML. Larger projects should export a data table from Tracker.

The imported analysis saves in the existing versioned `.trksess` format, including its source table and provenance. `.trk`/`.trz` are read-only import formats; Data Tool does not write Tracker projects or implement a video engine. CLI `--open` supports them, but acknowledgments remain exclusive to the versioned JSON protocol. Data Tool does not register itself as the default application for Tracker projects.

## Implementation evidence

The mapping was checked against the read-only OSP/Tracker sources: `ImageCoordSystem.Loader`, `FrameDataLoader`, `updateTransforms`, `PointMass.Loader`, `VideoClip` and `VideoPlayer`. The [Tracker file documentation](https://opensourcephysics.github.io/tracker-website/help/datafile.html) explains why saved pixel positions require calibration before analysis.

Committed tests use a small, hand-authored OSP XML fixture with a 90-degree rotation, unequal scales, missing steps and an explicitly shifted start time. Expected world coordinates follow an independently specified forward transform. Tests cover changing calibration, missing metadata, malformed input, archives, review/cancel and full session round trips. Local read-only checks also successfully read `BallTossOut-cv.trk`, `BallToss.trz` and `car.trz` from the reference checkout; those files are not runtime dependencies.

`fast-xml-parser` (MIT) validates/parses XML without Java or DOM APIs; `fflate` (MIT) reads ZIP entries with a filter before decompression. Both are JavaScript-only import dependencies, independent of the fitting solver. Locked versions are in `package-lock.json`. Adding this import workflow increased the measured compressed application bundle by approximately 28 KB; the numerical worker is unchanged. No numerical algorithm or numerical runtime dependency was added.
