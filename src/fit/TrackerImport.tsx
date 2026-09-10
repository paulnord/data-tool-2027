import { useEffect, useRef, useState } from "react";
import { trackerAnalysis, type TrackerProject } from "../import/tracker";

export default function TrackerImport({
  project,
  onReview,
  onCancel,
}: {
  project: TrackerProject;
  onReview: (analysis: ReturnType<typeof trackerAnalysis>) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [uniform, setUniform] = useState(false);
  const [error, setError] = useState("");
  const track = project.tracks[index];
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="tracker-import"
      aria-labelledby="tracker-import-title"
      onCancel={onCancel}
    >
      <h2 id="tracker-import-title">Import Tracker data</h2>
      <label>
        Track{" "}
        <select
          aria-label="Tracker track"
          value={index}
          onChange={(e) => {
            setIndex(Number(e.target.value));
            setUniform(false);
            setError("");
          }}
        >
          {project.tracks.map((t, i) => (
            <option key={i} value={i}>
              {t.name} — {t.fileName}
            </option>
          ))}
        </select>
      </label>
      <p>
        {track.rows.filter((r) => r.x !== null).length} saved positions in{" "}
        {track.rows.length} clip steps. Calibrated x/y and original pixel
        coordinates will be available in the data table. Missing steps remain
        blank.
      </p>
      <p>
        Frame number is selected initially. Video timing, derivatives and custom
        functions are not imported. Saved positions can include Tracker
        interpolation.
      </p>
      {track.interval !== null && track.startTime !== null && (
        <label className="tracker-timing">
          <input
            type="checkbox"
            checked={uniform}
            onChange={(e) => setUniform(e.target.checked)}
          />
          Use the saved {track.interval.toPrecision(6)} ms frame interval as
          uniform timing. I accept this assumption for this import.
        </label>
      )}
      <p>
        {track.lengthUnit
          ? `Saved length unit: ${track.lengthUnit}.`
          : "Length units are unspecified in this file; review them before fitting."}{" "}
        Measurement uncertainty and inference assumptions remain unknown.
      </p>
      {project.warnings.length > 0 && (
        <details open>
          <summary>Items not imported</summary>
          <ul>
            {project.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="tracker-import-actions">
        <button onClick={onCancel}>Cancel</button>
        <button
          onClick={() => {
            try {
              onReview(trackerAnalysis(track, uniform, crypto.randomUUID()));
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Review data
        </button>
      </div>
    </dialog>
  );
}
