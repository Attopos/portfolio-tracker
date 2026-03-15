import { useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/holdings", label: "Portfolio" },
  { to: "/transactions", label: "Transactions" },
];

function Topbar() {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const user = null;
  const userInitials = useMemo(() => {
    if (!user || !user.name) {
      return "PT";
    }

    return user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("");
  }, [user]);

  return (
    <nav className="topbar" aria-label="Primary">
      <div className="topbar-inner">
        <Link className="topbar-brand" to="/" aria-label="Portfolio Tracker home">
          PT
        </Link>

        <div className="topbar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "topbar-link is-active" : "topbar-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <div className="topbar-tools">
          <div className="add-menu">
            <button
              className="topbar-add-button"
              type="button"
              aria-expanded={isAddMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsAddMenuOpen((open) => !open)}
            >
              + Add
            </button>
            {isAddMenuOpen ? (
              <div className="topbar-menu-panel" role="menu">
                <Link
                  className="topbar-menu-link"
                  to="/transactions"
                  role="menuitem"
                  onClick={() => setIsAddMenuOpen(false)}
                >
                  Add transaction
                </Link>
                <Link
                  className="topbar-menu-link"
                  to="/holdings"
                  role="menuitem"
                  onClick={() => setIsAddMenuOpen(false)}
                >
                  Add holding
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="topbar-auth" aria-label="Authentication">
          {!user ? (
            <div className="topbar-auth-state">
              <Link className="topbar-auth-link" to="/signin-preview">
                Sign in
              </Link>
            </div>
          ) : (
            <div className="auth-menu">
              <button
                className="auth-avatar-button"
                type="button"
                aria-expanded={isAuthMenuOpen}
                aria-haspopup="menu"
                onClick={() => setIsAuthMenuOpen((open) => !open)}
              >
                <span className="auth-avatar-fallback">{userInitials}</span>
              </button>
              {isAuthMenuOpen ? (
                <div className="auth-menu-panel" role="menu">
                  <button
                    className="auth-menu-item"
                    type="button"
                    role="menuitem"
                    onClick={() => setIsAuthMenuOpen(false)}
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Topbar;
