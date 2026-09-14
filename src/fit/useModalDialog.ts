import { useEffect, type RefObject } from "react";

/** Open a modal and return keyboard focus to its visible invoking control. */
export function useModalDialog(
  ref: RefObject<HTMLDialogElement | null>,
  fallbackSelector: string,
  initialFocus?: string,
) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement;
    const menu =
      previous instanceof HTMLElement ? previous.closest("details") : null;
    const trigger =
      menu && !menu.open ? menu.querySelector("summary") : previous;
    dialog.showModal();
    if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      dialog.close();
      // React may remove the focused dialog after this cleanup. Restore focus
      // once removal is complete, and do not steal it from a new modal.
      queueMicrotask(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.closest("dialog[open]"))
          return;
        const visible = (element: Element | null): element is HTMLElement =>
          element instanceof HTMLElement &&
          element.isConnected &&
          element !== document.body &&
          !element.matches(":disabled") &&
          element.getClientRects().length > 0 &&
          !dialog.contains(element);
        const target = visible(trigger)
          ? trigger
          : document.querySelector(fallbackSelector);
        if (visible(target)) target.focus();
      });
    };
  }, [ref, fallbackSelector, initialFocus]);
}
