import { useEffect, useId, useRef } from "react";
import "./TransactionRecordedPopup.css";

interface TransactionRecordedPopupProps {
  message: string;
  onClose: () => void;
}

export default function TransactionRecordedPopup({ message, onClose }: TransactionRecordedPopupProps) {
  const headingId = useId();
  const okButtonRef = useRef<HTMLButtonElement>(null);

  // Move focus into the popup on mount so keyboard/screen-reader users land
  // on the OK button immediately, instead of focus staying on the (now gone)
  // Add Transaction button behind it.
  useEffect(() => {
    okButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="recorded-popup-overlay" role="presentation" onClick={onClose}>
      <div
        className="recorded-popup"
        role="alertdialog" // a dialog whose job is to announce a message, as opposed to role="dialog" for a form/menu
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
