import { useLayoutEffect, useRef, useState } from "react";
import "./sourceNotes.css";

/** Preserve every character while placing lengthy provenance on separate sheets. */
export default function SourceNotes({ text }: { text?: string | null }) {
  const probe = useRef<HTMLParagraphElement>(null);
  const [pages, setPages] = useState<string[]>([]);
  const long = !!text && (text.length > 500 || text.split("\n").length > 6);
  useLayoutEffect(() => {
    const element = probe.current;
    if (!long || !text || !element) return;
    function paginate() {
      if (!element || !text || element.clientWidth === 0) return;
      const chunks: string[] = [];
      let rest = text;
      while (rest.length) {
        let low = 1,
          high = rest.length;
        while (low < high) {
          const mid = Math.ceil((low + high) / 2);
          element.textContent = rest.slice(0, mid);
          if (element.scrollHeight <= 768) low = mid;
          else high = mid - 1;
        }
        let end = low;
        if (end < rest.length) {
          const boundary = rest.slice(0, end).search(/\s+\S*$/);
          if (boundary > 0) end = boundary + 1;
        }
        chunks.push(rest.slice(0, end));
        rest = rest.slice(end);
      }
      element.textContent = "";
      setPages(chunks);
    }
    paginate();
    const observer = new ResizeObserver(paginate);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, long]);
  if (!text) return null;
  if (!long) return <p className="report-short-notes">{text}</p>;
  return (
    <section className="report-source-notes" aria-label="Source notes appendix">
      <p
        className="report-notes-probe report-notes-text"
        ref={probe}
        aria-hidden="true"
      />
      {(pages.length ? pages : [text]).map((page, i, all) => (
        <section
          className="report-notes-page"
          key={i}
          aria-label={`Source notes page ${i + 1}`}
        >
          <h2>Source notes{i ? " (continued)" : ""}</h2>
          <p className="report-notes-page-label">
            Source notes · {i + 1} of {all.length}
          </p>
          <p className="report-notes-text">{page}</p>
        </section>
      ))}
    </section>
  );
}
