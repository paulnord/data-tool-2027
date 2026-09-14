import { useRef } from "react";
import { useModalDialog } from "./useModalDialog";

export function UnsavedChangesDialog({
  message,
  action,
  onKeep,
  onApply,
}: {
  message: string;
  action: string;
  onKeep: () => void;
  onApply: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useModalDialog(dialog, '.fit-app select[aria-label="Analysis"]', "button");
  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-label="Unsaved analysis changes"
      className="fit-confirm fit-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault();
        onKeep();
      }}
    >
      <p>{message}</p>
      <div>
        <button onClick={onKeep}>Keep working</button>
        <button onClick={onApply}>{action}</button>
      </div>
    </dialog>
  );
}
