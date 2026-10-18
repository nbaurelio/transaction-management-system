import { useEffect, useId, useRef } from "react";
import "./TransactionRecordedPopup.css";

interface TransactionRecordedPopupProps {
  message: string;
  onClose: () => void;
}

export default function TransactionRecordedPopup({ message, onClose }: TransactionRecordedPopupProps) {
  const headingId = useId();
  const okButtonRef = useRef<HTMLButtonElement>(null);

  // Focus OK so Enter/Escape work straight away.
  useEffect(() => {
    okButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="recorded-popup-overlay" role="presentation" onClick={onClose}>
      <div
        className="recorded-popup"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={headingId}>Transaction recorded</h2>
        <p>{message}</p>
        <div className="recorded-popup-actions">
          <button ref={okButtonRef} type="button" className="button button--primary" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
