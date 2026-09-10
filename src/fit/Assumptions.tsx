import { useEffect, useLayoutEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke, isTauri } from "@tauri-apps/api/core";
import "./assumptions.css";

const references = {
  assumptions: [
    "NIST: assumptions behind regression",
    "https://www.itl.nist.gov/div898/handbook/pmd/section2/pmd21.htm",
  ],
  residuals: [
    "NIST: checking a model using residuals",
    "https://www.itl.nist.gov/div898/handbook/pmd/section4/pmd44.htm",
  ],
  weights: [
    "NIST: weighted least squares",
    "https://www.itl.nist.gov/div898/handbook/pmd/section1/pmd143.htm",
  ],
  uncertainty: [
    "NIST: expressing measurement uncertainty",
    "https://physics.nist.gov/cuu/Uncertainty/basic.html",
  ],
} as const;
function Reference({ name }: { name: keyof typeof references }) {
  const [error, setError] = useState("");
  return (
    <>
      <a
        href={references[name][1]}
        target="_blank"
        rel="noopener noreferrer"
        onClick={async (e) => {
          if (!isTauri()) return;
          e.preventDefault();
          try {
            await invoke("open_fitting_reference", { reference: name });
          } catch {
            setError(
              "Could not open your browser. Copy the link address to read it there.",
            );
          }
        }}
      >
        {references[name][0]} ↗
      </a>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
function Guide({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  function close() {
    dialog.current?.close();
    onClose();
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="assumptions-guide"
      aria-labelledby="fitting-guide-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header>
        <h1 id="fitting-guide-title">Fitting and its assumptions</h1>
        <button onClick={close}>Close guide</button>
      </header>
      <article>
        <p className="guide-intro">
          A fit connects measurements to a physical model. It estimates
          quantities such as a velocity, spring constant, or decay time. The
          uncertainty in those estimates depends on how the measurements were
          made and whether the model describes the experiment.
        </p>
        <nav aria-label="Fitting guide contents">
          <a href="#guide-fit">What a fit does</a>
          <a href="#guide-assumptions">The assumptions</a>
          <a href="#guide-residuals">Reading residuals</a>
          <a href="#guide-uncertainty">Understanding uncertainty</a>
          <a href="#guide-report">Reporting a result</a>
        </nav>
        <section id="guide-fit">
          <h2>1. What a fit does</h2>
          <p>
            For constant-speed motion, position = initial position + velocity ×
            time. The fit chooses the initial position and velocity that best
            describe the selected measurements. A residual is observed position
            minus predicted position; it has the same units as position.
          </p>
          <p>
            Least squares minimizes the sum of squared residuals. With supplied
            standard uncertainties σ, it minimizes the sum of (residual / σ)²
            instead. A point with half the σ has four times the weight. Changing
            to logarithmic graph axes changes the display, not the observations
            or the quantity minimized.
          </p>
          <p>
            A curve can be fitted without accepting the assumptions below.
            However, a best-fitting number alone does not establish how
            precisely the corresponding physical quantity is known.
          </p>
        </section>
        <section id="guide-assumptions">
          <h2>2. What you accept with the checkbox</h2>
          <p>
            Checking <strong>Accept uncertainty assumptions</strong> allows
            uncertainty estimates conditional on assumptions that have not been
            established. It does not verify them. Assumptions recorded as known
            to be false still prevent inference. With unknown assumptions left
            unaccepted, the app can provide a descriptive fit without
            statistical uncertainty estimates.
          </p>
          <ol>
            <li>
              <strong>The horizontal variable is treated as exact.</strong> For
              a time plot, timing uncertainty is ignored by this fitting method.
              That may be a useful approximation with reliable frame timing, but
              not with substantial timing jitter. If uncertainty in X
              contributes appreciably to the vertical residual, a method that
              includes uncertainty in both axes is needed.
            </li>
            <li>
              <strong>The model and fixed parameters are appropriate.</strong> A
              straight line represents constant velocity over the selected
              interval. A visibly accelerating cart needs a different model or a
              justified interval. Fixing a parameter treats its value as exact;
              its uncertainty is not propagated into the other fitted
              parameters.
            </li>
            <li>
              <strong>
                Measurement errors have zero mean and are independent.
              </strong>{" "}
              Repeated measurements should not systematically lie on one side of
              the physical relation. Smoothing, shared drift, or tracking errors
              persisting across frames can link neighboring errors. More linked
              points do not provide as much new information as the same number
              of independent measurements.
            </li>
            <li>
              <strong>The uncertainty model describes the scatter.</strong>{" "}
              Equal-scatter fitting assumes the same unknown error scale for
              every included point. Supplied σ values must be positive standard
              uncertainties in Y units. Different σ values allow different
              precision; they are not percentages or 95% interval half-widths
              unless converted appropriately.
            </li>
            <li>
              <strong>
                Errors are approximately Gaussian for the reported inference.
              </strong>{" "}
              This means a bell-shaped distribution about the model, not that
              the measured positions themselves must form a bell curve.
              Normality supports the interval and goodness-of-fit calculations;
              it is not required merely to calculate a least-squares minimum.
            </li>
          </ol>
          <p>
            <Reference name="assumptions" />
          </p>
        </section>
        <section id="guide-residuals">
          <h2>3. Read the residuals before trusting a number</h2>
          <p>
            Look for scatter around zero without an obvious trend. Curvature can
            indicate a missing physical effect; a widening spread can indicate
            changing precision; long runs of similar residuals can suggest drift
            or correlation. A small sample may show accidental patterns, so
            appearance alone cannot prove the assumptions.
          </p>
          <p>
            Fitting itself constrains residuals, so they are not independent
            copies of the measurement errors. Compare their scale with the
            uncertainties you supplied. A large R² does not establish that a
            model is appropriate. <Reference name="residuals" />
          </p>
          <p>
            Investigate unusual points rather than deleting them just to improve
            the fit. Record exclusions and their experimental justification. In
            a collision analysis, choose before/after intervals that avoid the
            interaction. The displayed intervals do not account for uncertainty
            introduced by choosing boundaries after inspecting the data.
          </p>
        </section>
        <section id="guide-uncertainty">
          <h2>
            4. Measurement scatter and parameter uncertainty are different
          </h2>
          <p>
            <strong>Measurement σ</strong> describes the uncertainty of an
            individual Y measurement. <strong>Parameter standard error</strong>{" "}
            describes the estimated uncertainty of a fitted coefficient under
            the model. For example, positions in meters can produce a velocity
            estimate and standard error in meters per second.
          </p>
          <p>
            Choose <strong>Estimate scatter from residuals</strong> when you
            have no supplied σ. This means unknown scatter, not zero error. For
            an ordinary linear fit, the residual variance estimate divides the
            sum of squared residuals by n − k, where n is the number of included
            observations and k is the number of free parameters. Two points
            determine a line but leave no degrees of freedom to estimate
            scatter.
          </p>
          <p>
            When σ is supplied, the app uses its absolute scale. It does not
            enlarge or shrink σ to force reduced χ² to one. Incorrect weights
            can distort both the fit and its uncertainty; estimated weights also
            have their own uncertainty. <Reference name="weights" />
          </p>
          <p>
            A <strong>95% confidence interval</strong> is constructed by a
            method intended to cover the true parameter in 95% of repeated
            experiments under its assumptions. It is not a statement that 95% of
            observations should fall inside that interval. A shaded mean-curve
            band describes the fitted mean, not the range of future
            measurements, and its 95% coverage is pointwise rather than
            simultaneous over the whole curve.
          </p>
          <p>
            For nonlinear models, parameter errors and intervals are local
            approximations. Starting values, competing minima, or parameters
            that have nearly indistinguishable effects can make them unreliable.
            Check convergence and rank diagnostics. The app does not turn a
            failed or unidentifiable fit into a precise result.
          </p>
        </section>
        <section id="guide-report">
          <h2>5. What belongs in a first lab report</h2>
          <ul>
            <li>
              Name the model and explain why it describes the selected part of
              the experiment.
            </li>
            <li>
              Give fitted quantities with units, and say whether “±” is a
              standard error or a confidence interval.
            </li>
            <li>
              Include residuals, the uncertainty model, any fixed values, and
              the selected interval or excluded observations.
            </li>
            <li>
              Discuss calibration, timing, and other systematic effects that the
              fit does not include.
            </li>
          </ul>
          <p>
            A ruler calibration error can affect every position together while
            leaving small residuals. A small fitted standard error therefore
            need not mean a small total measurement uncertainty. NIST’s
            measurement-uncertainty guidance addresses the wider measurement
            process, including contributions beyond random scatter.{" "}
            <Reference name="uncertainty" />
          </p>
          <p>
            For collisions, each before/after component fit is independent in
            this app. Uncertainty in a later momentum or energy calculation may
            require masses, calibration uncertainties, and correlations between
            components that this fit report does not supply.
          </p>
        </section>
        <p className="guide-note">
          This guide is part of Data Tool and works offline. NIST links open in
          your browser and require an internet connection.
        </p>
      </article>
    </dialog>,
    document.body,
  );
}
export default function Assumptions({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [guide, setGuide] = useState(false),
    [tip, setTip] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, maxHeight: 300 });
  const button = useRef<HTMLButtonElement>(null),
    popup = useRef<HTMLDivElement>(null),
    selecting = useRef(false),
    openTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  function keepOpen() {
    if (timer.current) clearTimeout(timer.current);
  }
  function cancelOpening() {
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
  }
  function hover() {
    keepOpen();
    cancelOpening();
    if (!tip) openTimer.current = setTimeout(show, 500);
  }
  function show() {
    cancelOpening();
    keepOpen();
    setTip(true);
  }
  function hide() {
    cancelOpening();
    keepOpen();
    timer.current = setTimeout(() => {
      const selection = window.getSelection();
      if (
        selecting.current ||
        (selection?.toString() && popup.current?.contains(selection.anchorNode))
      )
        return;
      setTip(false);
    }, 250);
  }
  useLayoutEffect(() => {
    if (!tip || guide) return;
    function place() {
      const anchor = button.current?.getBoundingClientRect(),
        panel = popup.current;
      if (!anchor || !panel) return;
      const gap = 8,
        margin = 12;
      const below = Math.max(
        0,
        window.innerHeight - margin - anchor.bottom - gap,
      );
      const above = Math.max(0, anchor.top - gap - margin);
      const height = panel.scrollHeight + 2;
      const useBelow = below >= height || below >= above;
      const maxHeight = useBelow ? below : above;
      setPosition({
        left: Math.max(
          margin,
          Math.min(
            anchor.left,
            window.innerWidth - panel.getBoundingClientRect().width - margin,
          ),
        ),
        top: useBelow
          ? anchor.bottom + gap
          : anchor.top - gap - Math.min(height, maxHeight),
        maxHeight,
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [tip, guide]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      cancelOpening();
    },
    [],
  );
  useEffect(() => {
    const scrolling = () => {
      if (openTimer.current) {
        cancelOpening();
        openTimer.current = setTimeout(show, 500);
      }
    };
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelOpening();
    };
    window.addEventListener("scroll", scrolling, true);
    window.addEventListener("keydown", cancelOnEscape, true);
    return () => {
      window.removeEventListener("scroll", scrolling, true);
      window.removeEventListener("keydown", cancelOnEscape, true);
    };
  }, []);
  useEffect(() => {
    if (!tip) return;
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTip(false);
    };
    const outside = (e: PointerEvent) => {
      if (
        !popup.current?.contains(e.target as Node) &&
        !button.current?.contains(e.target as Node)
      )
        setTip(false);
    };
    const release = () => {
      selecting.current = false;
    };
    window.addEventListener("keydown", dismiss, true);
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    return () => {
      window.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
    };
  }, [tip]);
  return (
    <div className="assumptions-control">
      <input
        type="checkbox"
        aria-label="Accept uncertainty assumptions"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <button
        ref={button}
        type="button"
        className="assumptions-link"
        aria-haspopup="dialog"
        aria-describedby={tip ? id : undefined}
        onMouseEnter={hover}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => {
          cancelOpening();
          setTip(false);
          setGuide(true);
        }}
      >
        Accept uncertainty assumptions
      </button>
      {tip &&
        !guide &&
        createPortal(
          <div
            ref={popup}
            id={id}
            tabIndex={0}
            role="tooltip"
            className="assumptions-tooltip"
            style={position}
            onMouseEnter={keepOpen}
            onFocus={keepOpen}
            onBlur={hide}
            onPointerDown={() => {
              selecting.current = true;
              keepOpen();
            }}
            onMouseLeave={hide}
          >
            <strong>For conditional uncertainty estimates</strong>
            <ul>
              <li>X (or time) is treated as exact.</li>
              <li>The model and fixed values are appropriate.</li>
              <li>Y errors are independent, zero-mean and Gaussian.</li>
              <li>Equal scatter or supplied σ describes the errors.</li>
            </ul>
            <p>
              Checking accepts these assumptions; it does not test them. Known
              violations still block inference.
            </p>
            <p>Click the label for the fitting guide.</p>
          </div>,
          document.body,
        )}
      {guide && (
        <Guide
          onClose={() => {
            setGuide(false);
            button.current?.focus();
          }}
        />
      )}
    </div>
  );
}
