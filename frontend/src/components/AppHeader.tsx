import logoUrl from "../assets/header-logo.jpeg";
import "./AppHeader.css";

interface AppHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function AppHeader({ searchQuery, onSearchChange }: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="app-header-brand">
          {/* Decorative; the title beside it names the app. */}
          <span className="app-header-badge">
            <img className="app-header-mark" src={logoUrl} alt="" width="50" height="50" />
          </span>
          <div className="app-header-titles">
            <span className="app-header-title">Transaction Management System</span>
            <span className="app-header-subtitle">First Circle</span>
          </div>
        </div>

        <div className="app-header-tools">
          <label className="app-header-search">
            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by name or account number"
              aria-label="Search transactions by account holder name or account number"
            />
          </label>
        </div>
      </div>
    </header>
  );
}
