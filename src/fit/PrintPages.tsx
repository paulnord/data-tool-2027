import { createPortal } from "react-dom";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./printPages.css";

const pageHeight = 960;
const paperWidth = 816;

function preserveUniqueIds(element: HTMLElement, page: number) {
  const ids = new Map<string, string>();
  for (const node of element.querySelectorAll("[id]")) {
    const original = node.id;
    node.id = `report-page-${page}-${original}`;
    ids.set(original, node.id);
  }
  for (const node of element.querySelectorAll("*")) {
    for (const attribute of [...node.attributes]) {
      let value = attribute.value;
      for (const [original, id] of ids) {
        value = value.replaceAll(`url(#${original})`, `url(#${id})`);
        if (value === `#${original}`) value = `#${id}`;
      }
      if (value !== attribute.value) node.setAttribute(attribute.name, value);
    }
  }
}

/** Measure actual rendered blocks; the resulting pages are also the print DOM. */
function paginate(source: HTMLElement, work: HTMLElement): string[] {
  const pages: string[] = [];
  const fits = () => work.scrollHeight <= pageHeight;
  const finish = () => {
    if (!work.childElementCount) return;
    preserveUniqueIds(work, pages.length + 1);
    pages.push(work.innerHTML);
    work.replaceChildren();
  };
  const addParagraph = (paragraph: HTMLElement) => {
    let text = paragraph.textContent ?? "";
    while (text.length) {
      const part = paragraph.cloneNode(false) as HTMLElement;
      work.append(part);
      let low = 0;
      let high = text.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        part.textContent = text.slice(0, mid);
        if (fits()) low = mid;
        else high = mid - 1;
      }
      if (!low && work.childElementCount > 1) {
        part.remove();
        finish();
        continue;
      }
      let end = Math.max(1, low);
      if (end < text.length) {
        const boundary = text.slice(0, end).search(/\s+\S*$/);
        if (boundary > 0) end = boundary + 1;
      }
      part.textContent = text.slice(0, end);
      text = text.slice(end);
      if (text.length) finish();
    }
  };
  const addTable = (table: HTMLTableElement) => {
    const rows = [...table.tBodies].flatMap((body) => [...body.rows]);
    const firstRowIsHeader =
      !table.tHead &&
      rows[0] &&
      [...rows[0].cells].every((cell) => cell.tagName === "TH");
    const header = firstRowIsHeader ? rows.shift() : null;
    let index = 0;
    while (index < rows.length) {
      const group = document.createElement("div");
      group.className = "fit-print-results fit-print-split-results";
      const part = table.cloneNode(false) as HTMLTableElement;
      for (const child of table.children) {
        if (child.tagName !== "TBODY") part.append(child.cloneNode(true));
      }
      if (header) {
        const head = document.createElement("thead");
        head.append(header.cloneNode(true));
        part.append(head);
      }
      const body = document.createElement("tbody");
      part.append(body);
      group.append(part);
      work.append(group);
      const start = index;
      while (index < rows.length) {
        const row = rows[index].cloneNode(true) as HTMLTableRowElement;
        body.append(row);
        if (!fits()) {
          row.remove();
          break;
        }
        index++;
      }
      if (index === start) {
        group.remove();
        if (work.childElementCount) {
          finish();
          continue;
        }
        // An exceptionally tall row still remains intact and readable. Shrink
        // this table fragment uniformly to fit; never drop cell text.
        body.append(rows[index++].cloneNode(true));
        work.append(group);
        const height = work.scrollHeight;
        group.style.transformOrigin = "top left";
        group.style.transform = `scale(${pageHeight / height})`;
        group.style.height = `${pageHeight}px`;
      }
      if (index < rows.length) finish();
    }
  };
  const add = (original: HTMLElement, forcePage = false) => {
    if (forcePage) finish();
    const block = original.cloneNode(true) as HTMLElement;
    work.append(block);
    if (fits()) return;
    block.remove();
    if (work.childElementCount) finish();
    work.append(block);
    if (fits()) return;
    block.remove();
    if (block.classList.contains("fit-print-results")) {
      for (const table of original.querySelectorAll("table")) addTable(table);
    } else if (block.tagName === "P") {
      addParagraph(block);
    } else {
      // Graphs and source-note sheets stay whole. Normally their fixed sizes
      // already fit; this also accommodates an unusually long graph title.
      work.append(block);
      const height = work.scrollHeight;
      const frame = document.createElement("div");
      frame.style.height = `${pageHeight}px`;
      block.replaceWith(frame);
      frame.append(block);
      block.style.transformOrigin = "top left";
      block.style.transform = `scale(${pageHeight / height})`;
      finish();
    }
  };
  const graph = source.querySelector<HTMLElement>(".fit-print-graph-sheet");
  if (graph) add(graph);
  if (source.classList.contains("is-full-page")) finish();
  const details = source.querySelector<HTMLElement>(".fit-print-details");
  for (const block of details?.children ?? []) {
    if (block.classList.contains("report-source-notes")) {
      for (const sheet of block.querySelectorAll(".report-notes-page")) {
        const wrapper = block.cloneNode(false) as HTMLElement;
        wrapper.append(sheet.cloneNode(true));
        add(wrapper, true);
      }
    } else {
      add(block as HTMLElement);
    }
  }
  finish();
  return pages;
}

export default function PrintPages({
  children,
  fullPageGraph,
}: {
  children: ReactNode;
  fullPageGraph: boolean;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const source = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState<HTMLDivElement | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const host = document.createElement("div");
    host.className = "fit-print-measure";
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    // Retain the app's typography without inserting a duplicate report in the
    // dialog or making its hidden controls accessible.
    viewport.current?.closest(".fit-app")?.append(host);
    setMount(host);
    return () => host.remove();
  }, []);

  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const resize = () =>
      setScale(Math.min(1, element.clientWidth / paperWidth));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = source.current;
    if (!element || !mount) return;
    const work = document.createElement("div");
    work.className = `fit-print-document fit-print-page-work${fullPageGraph ? " is-full-page" : ""}`;
    mount.append(work);
    let pending = 0;
    const update = () => {
      pending = 0;
      if (!element.clientWidth) return;
      if (fullPageGraph) {
        const sheet = element.querySelector<HTMLElement>(
          ".fit-print-graph-sheet",
        );
        const graph = element.querySelector<HTMLElement>(
          ".fit-print-graph-content",
        );
        if (sheet && graph) {
          const value = String(Math.min(1, 720 / graph.offsetHeight));
          if (sheet.style.getPropertyValue("--print-content-scale") !== value)
            sheet.style.setProperty("--print-content-scale", value);
        }
      }
      const next = paginate(element, work);
      setPages((previous) =>
        previous.length === next.length &&
        previous.every((page, i) => page === next[i])
          ? previous
          : next,
      );
    };
    const schedule = () => {
      if (!pending) pending = requestAnimationFrame(update);
    };
    const changes = new MutationObserver(schedule);
    changes.observe(element, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    const size = new ResizeObserver(schedule);
    size.observe(element);
    schedule();
    void document.fonts.ready.then(schedule);
    return () => {
      changes.disconnect();
      size.disconnect();
      cancelAnimationFrame(pending);
      work.remove();
    };
  }, [mount, fullPageGraph]);

  const page = (html: string, index: number) => (
    <section
      className="fit-print-page"
      data-last-page={index === pages.length - 1 || undefined}
      aria-label={`Page ${index + 1} of ${pages.length}`}
      key={index}
    >
      <span className="fit-print-page-label" aria-hidden="true">
        Page {index + 1} of {pages.length}
      </span>
      <div
        className={`fit-print-page-content fit-print-document${fullPageGraph ? " is-full-page" : ""}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
  return (
    <div className="fit-print-pages-viewport" ref={viewport}>
      {mount &&
        createPortal(
          <div
            className={`fit-print-document${fullPageGraph ? " is-full-page" : ""}`}
            ref={source}
          >
            {children}
          </div>,
          mount,
        )}
      <div
        className="fit-print-pages"
        style={{ "--print-preview-scale": scale } as CSSProperties}
      >
        {fullPageGraph && pages[0] && page(pages[0], 0)}
        <div className="fit-print-details">
          {pages
            .slice(fullPageGraph ? 1 : 0)
            .map((html, index) => page(html, index + (fullPageGraph ? 1 : 0)))}
        </div>
      </div>
    </div>
  );
}
