import type { KeyboardEvent } from "react";

function items(menu: Element) {
  return Array.from(
    menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ).filter(
    (item) => !item.matches(":disabled") && item.getClientRects().length > 0,
  );
}

export function moveMenuFocus(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const choices = items(event.currentTarget);
  if (!choices.length) return;
  event.preventDefault();
  const index = choices.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? choices.length - 1
        : event.key === "ArrowDown"
          ? (index + 1) % choices.length
          : index < 0
            ? choices.length - 1
            : (index + choices.length - 1) % choices.length;
  choices[next].focus();
}

export function openMenuFromKey(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const details = event.currentTarget.closest("details");
  if (!details) return;
  event.preventDefault();
  details.open = true;
  const choices = items(details);
  (event.key === "ArrowUp" ? choices.at(-1) : choices[0])?.focus();
}
