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
  bevington: [
    "Bevington and Robinson: Data Reduction and Error Analysis (3rd edition, PDF)",
    "https://experimentationlab.berkeley.edu/sites/default/files/pdfs/Bevington.pdf",
  ],
  gum: [
    "JCGM GUM: Guide to the Expression of Uncertainty in Measurement",
    "https://doi.org/10.59161/JCGM100-2008E",
  ],
  ea: [
    "EA-4/02: Uncertainty of Measurement in Calibration (PDF)",
    "https://european-accreditation.org/wp-content/uploads/2018/10/EA-4-02.pdf",
  ],
  aapt: [
    "AAPT: Undergraduate Physics Laboratory Recommendations (PDF)",
    "https://www.aapt.org/resources/upload/labguidlinesdocument_ebendorsed_nov10.pdf",
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
          Data Tool estimates model parameters from numerical observations using
          ordinary or weighted least squares. Its uncertainty estimates follow
          established regression methods under explicit assumptions. This guide
          describes the fitting objective, numerical methods, diagnostics, and
          limits of the reported uncertainty.
        </p>
        <nav aria-label="Fitting guide contents">
          <a href="#guide-fit">What a fit does</a>
          <a href="#guide-assumptions">The assumptions</a>
          <a href="#guide-residuals">Reading residuals</a>
          <a href="#guide-uncertainty">Understanding uncertainty</a>
          <a href="#guide-report">Numerical methods and scope</a>
          <a href="#guide-references">References and further reading</a>
        </nav>
        <section id="guide-fit">
          <h2>1. What a fit does</h2>
          <p>
            A model expresses Y as a function of X and a set of parameters. For
            a line, y = b + m*x, the fitted parameters are the intercept b and
            slope m. A residual is the observed Y minus the predicted Y, in the
            original Y units. Fixed parameters are held at their specified
            values; only free parameters are estimated.
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
            precisely the corresponding parameter is known.
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
              regression in this app, uncertainty in X is not propagated. If
              uncertainty in X contributes appreciably to the vertical residual,
              a method that includes uncertainty in both axes is needed.
            </li>
            <li>
              <strong>The model and fixed parameters are appropriate.</strong> A
              model must describe the mean response over the selected range.
              Fixing a parameter treats its value as exact; its uncertainty is
              not propagated into the other fitted parameters.
            </li>
            <li>
              <strong>
                Measurement errors have zero mean and are independent.
              </strong>{" "}
              Repeated measurements should not systematically lie on one side of
              the modeled relation. Smoothing, shared drift, or instrument
              effects persisting across observations can link neighboring
              errors. More linked points do not provide as much new information
              as the same number of independent measurements.
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
              the observed Y values themselves must form a bell curve. Normality
              supports the interval and goodness-of-fit calculations; it is not
              required merely to calculate a least-squares minimum.
            </li>
          </ol>
          <p>
            <Reference name="assumptions" />
          </p>
        </section>
        <section id="guide-residuals">
          <h2>3. Residual diagnostics</h2>
          <p>
            Look for scatter around zero without an obvious trend. Curvature can
            indicate model mismatch; a widening spread can indicate changing
            precision; long runs of similar residuals can suggest drift or
            correlation. A small sample may show accidental patterns, so
            appearance alone cannot prove the assumptions.
          </p>
          <p>
            Fitting itself constrains residuals, so they are not independent
            copies of the measurement errors. Compare their scale with the
            uncertainties you supplied. A large R² does not establish that a
            model is appropriate. <Reference name="residuals" />
          </p>
          <p>
            Exclusions and selected ranges determine which observations enter
            the objective. Reported confidence intervals do not account for
            choosing observations, boundaries, or models after inspecting the
            data. Overlapping fit ranges can produce correlated estimates;
            separate interval fits do not calculate that cross-fit covariance.
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
          <h2>5. Numerical methods and scope</h2>
          <p>
            Models linear in their free parameters use column-scaled,
            rank-revealing QR least squares. Nonlinear models use iterative
            optimization with QR steps and a final Jacobian rank check. The
            solver does not explicitly invert normal equations. Rank loss,
            invalid domains, and convergence failures are reported explicitly. A
            successful nonlinear fit does not establish a global optimum.
          </p>
          <p>
            For full-rank linear fits, supplied absolute standard uncertainties
            determine parameter covariance without residual rescaling.
            Residual-estimated scatter uses the residual degrees of freedom.
            Marginal 95% intervals use normal quantiles for known uncertainty
            and Student-t quantiles for estimated scatter. Nonlinear intervals
            use a local approximation; the chi-square tail probability Q is
            unavailable for fits with free nonlinear parameters.
          </p>
          <p>
            These are regression uncertainty estimates, not a complete
            measurement uncertainty budget. Calibration errors, uncertainty in
            fixed parameters, and shared systematic effects can remain even when
            residuals are small. Propagation into derived quantities may require
            additional inputs and correlations. <Reference name="uncertainty" />
          </p>
          <p>
            The implementation is checked against independent numerical
            references and simulation tests in documented regimes. These checks
            support the implemented methods; they do not certify every dataset
            or establish that its assumptions hold.
          </p>
        </section>
        <section id="guide-references">
          <h2>6. References and further reading</h2>
          <p>
            Data Tool brings established least-squares methods into an
            interactive analysis workflow: built-in and custom models, weighted
            fitting, independent fits across multiple intervals, and residual
            plots alongside the data. Rank and convergence diagnostics,
            parameter standard errors, and confidence intervals make the results
            assessable under explicit assumptions. Numerical tests compare
            results with independent references and check interval coverage in
            documented regimes. Original observations, units and analysis
            settings remain available for review, with reports ready to copy or
            print.
          </p>
          <ul>
            <li>
              <Reference name="bevington" /> — statistical foundations,
              least-squares fitting and fit diagnostics; chapters 6–8 and 11.
            </li>
            <li>
              <Reference name="assumptions" />
            </li>
            <li>
              <Reference name="weights" />
            </li>
            <li>
              <Reference name="residuals" />
            </li>
            <li>
              <Reference name="uncertainty" />
            </li>
            <li>
              <Reference name="gum" /> — international framework for evaluating
              and combining measurement uncertainties.
            </li>
            <li>
              <Reference name="ea" /> — application of GUM principles to
              calibration budgets and expanded uncertainty.
            </li>
            <li>
              <Reference name="aapt" /> — curriculum recommendations, including
              use of professional uncertainty methods; not a separate fitting
              algorithm.
            </li>
          </ul>
          <p>
            <strong>Calibration scope.</strong> For EA-4/02 calibration work,
            supplement the fit with an assessment of calibration, resolution,
            environmental and other systematic effects, including relevant
            correlations. These contributions and an appropriate coverage factor
            are needed for a complete expanded-uncertainty statement; Data Tool
            does not evaluate them automatically.
          </p>
        </section>
        <p className="guide-note">
          This guide is part of Data Tool and works offline. Reference links
          open in your browser and require an internet connection.
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
