import { useState } from "react";
import {
  ArrowsRightLeftIcon,
  ChartPieIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext.jsx";

const navItems = [
  { to: "/", label: "Dashboard", end: true, icon: HomeIcon },
  { to: "/holdings", label: "Portfolio", icon: ChartPieIcon },
  { to: "/transactions", label: "Transactions", icon: ArrowsRightLeftIcon },
];

function Topbar() {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isAuthMenuOpen, setIsAuthMenuOpen] = useState(false);
  const location = useLocation();
  const { isLoading, signOut, user } = useAuth();
  const nextPath = location.pathname === "/signin" ? "/" : location.pathname;
  const userInitials = !user || !user.name
    ? "PT"
    : user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
  const avatarUrl = user ? String(user.avatar_url || user.picture || "").trim() : "";

  async function handleSignOut() {
    try {
      await signOut();
      setIsAuthMenuOpen(false);
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }

  return (
    <>
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
                    to="/transactions?action=transaction"
                    role="menuitem"
                    onClick={() => setIsAddMenuOpen(false)}
                  >
                    Add transaction
                  </Link>
                  <Link
                    className="topbar-menu-link"
                    to="/holdings?action=create"
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
                <Link
                  className="topbar-auth-link"
                  to={`/signin?next=${encodeURIComponent(nextPath || "/")}`}
                >
                  {isLoading ? "Checking..." : "Sign in"}
                </Link>
              </div>
            ) : (
              <div className="auth-menu">
                <button
                  className="auth-avatar-button"
                  type="button"
                  aria-expanded={isAuthMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Open user menu"
                  onClick={() => setIsAuthMenuOpen((open) => !open)}
                >
                  {avatarUrl ? (
                    <img className="auth-avatar-image" src={avatarUrl} alt="User avatar" />
                  ) : (
                    <span className="auth-avatar-fallback">{userInitials}</span>
                  )}
                </button>
                {isAuthMenuOpen ? (
                  <div className="auth-menu-panel" role="menu">
                    <button
                      className="auth-menu-item"
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
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

      <div className="mobile-tabbar" aria-label="Primary mobile">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? "mobile-tabbar-link is-active" : "mobile-tabbar-link"
              }
            >
              <Icon className="mobile-tabbar-icon" aria-hidden="true" />
              <span className="mobile-tabbar-label">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </>
  );
}

export default Topbar;
