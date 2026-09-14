import {
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

type Options = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  boundaryRef?: RefObject<HTMLElement | null>;
  scale?: number;
  margin?: number;
  gap?: number;
  align?: "start" | "end";
};

/** Position an absolute popover inside the visible viewport and scroll containers. */
export function usePopoverLayout({
  open,
  anchorRef,
  panelRef,
  boundaryRef,
  scale,
  margin = 12,
  gap = 4,
  align = "end",
}: Options): CSSProperties {
  const [layout, setLayout] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    const anchor = anchorRef.current,
      panel = panelRef.current;
    if (!open || !anchor || !panel) return;
    const position = () => {
      let left = margin,
        right = innerWidth - margin,
        top = margin,
        bottom = innerHeight - margin,
        zoom = scale ?? 1;
      for (
        let parent: HTMLElement | null = anchor;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        if (scale === undefined) zoom *= Number(style.zoom) || 1;
        if (
          parent === anchor ||
          parent === document.body ||
          parent === document.documentElement
        )
          continue;
        const rect = parent.getBoundingClientRect();
        const boundary =
          parent === boundaryRef?.current || parent.matches("dialog[open]");
        if (boundary || /auto|scroll|hidden|clip/.test(style.overflowX)) {
          left = Math.max(left, rect.left + margin);
          right = Math.min(right, rect.right - margin);
        }
        if (boundary || /auto|scroll|hidden|clip/.test(style.overflowY)) {
          top = Math.max(top, rect.top + margin);
          bottom = Math.min(bottom, rect.bottom - margin);
        }
      }
      const anchorBox = anchor.getBoundingClientRect(),
        panelBox = panel.getBoundingClientRect(),
        availableWidth = Math.max(0, right - left),
        width = Math.min(panelBox.width, availableWidth),
        border = Math.max(0, panel.offsetHeight - panel.clientHeight) * zoom,
        naturalHeight = panel.scrollHeight * zoom + border,
        below = Math.max(0, bottom - anchorBox.bottom - gap),
        above = Math.max(0, anchorBox.top - gap - top),
        useAbove = naturalHeight > below && above > below,
        availableHeight = useAbove ? above : below,
        height = Math.min(naturalHeight, availableHeight),
        x = Math.max(
          left,
          Math.min(
            align === "start" ? anchorBox.left : anchorBox.right - width,
            right - width,
          ),
        ),
        y = useAbove ? anchorBox.top - gap - height : anchorBox.bottom + gap;
      const next: CSSProperties = {
        left: (x - anchorBox.left) / zoom,
        right: "auto",
        top:
          (Math.max(top, Math.min(y, bottom - height)) - anchorBox.top) / zoom,
        maxWidth: availableWidth / zoom,
        maxHeight: availableHeight / zoom,
        overflowY: "auto",
        boxSizing: "border-box",
      };
      setLayout((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(panel);
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [open, anchorRef, panelRef, boundaryRef, scale, margin, gap, align]);
  return layout;
}
