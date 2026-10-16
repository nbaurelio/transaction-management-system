import "./AppHeader.css";

export default function AppHeader() {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-brand">
          <span className="app-header-mark" aria-hidden="true">
            T
          </span>
          <div className="app-header-titles">
            <span className="app-header-title">Transaction Management System</span>
            <span className="app-header-subtitle">Track and record account transactions</span>
          </div>
        </div>
      </div>
    </header>
  );
}
