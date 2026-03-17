import { useMemo } from "react";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { buildMarketFooterText } from "../features/portfolio/portfolioSelectors.js";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";

function SettingsPage() {
  const { isAuthenticated, user } = useAuth();
  const {
    cnyPerUsdRate,
    lastMarketSyncAt,
    marketPricesBySymbol,
    marketStatus,
    positions,
    transactions,
  } = usePortfolioWorkspace();

  const marketFooterText = useMemo(() => {
    return buildMarketFooterText(cnyPerUsdRate, marketPricesBySymbol, lastMarketSyncAt);
  }, [cnyPerUsdRate, lastMarketSyncAt, marketPricesBySymbol]);

  return (
    <section className="page-panel page-stack">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Settings</p>
          <h1>Workspace settings</h1>
          <p className="page-copy">
            A compact operational view for account state, market-data context, and the design system principles shaping this product workspace.
          </p>
        </div>
      </header>

      <section className="settings-grid">
        <article className="workspace-card">
          <div className="section-head section-head-detail">
            <div>
              <span className="section-kicker">Account</span>
              <h2>Access & session</h2>
            </div>
          </div>
          <div className="settings-list">
            <div className="settings-row">
              <div className="settings-copy">
                <strong>Authentication</strong>
                <span>Current workspace access state</span>
              </div>
              <span className={isAuthenticated ? "status-badge" : "status-badge is-amber"}>
                {isAuthenticated ? "Signed in" : "Signed out"}
              </span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <strong>User</strong>
                <span>Connected identity for this session</span>
              </div>
              <span className="value-badge">{user?.name || user?.email || "Guest"}</span>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <strong>Workspace model</strong>
                <span>Shared state across dashboard, holdings, detail, and transactions</span>
              </div>
              <span className="tag-badge">Unified product shell</span>
            </div>
          </div>
        </article>

        <aside className="workspace-card">
          <div className="section-head section-head-detail">
            <div>
              <span className="section-kicker">System</span>
              <h2>Data status</h2>
            </div>
          </div>
          <div className="settings-meta">
            <span className="status-badge">FX USD/CNY {cnyPerUsdRate.toFixed(4)}</span>
            <span className="value-badge">{Object.keys(marketPricesBySymbol).length} live prices</span>
            <span className="value-badge">{positions.length} holdings</span>
            <span className="value-badge">{transactions.length} transactions</span>
            <p className="settings-note">
              {marketStatus || `Last market refresh recorded at ${lastMarketSyncAt || "pending sync"}.`}
            </p>
          </div>
        </aside>
      </section>

      <section className="workspace-card">
        <div className="section-head section-head-detail">
          <div>
            <span className="section-kicker">Design System</span>
            <h2>Slate / Blue / Amber</h2>
            <p className="section-subcopy">
              Product styling is now standardized around dark slate surfaces, blue interaction states, amber highlights, and strict green/red usage for performance semantics only.
            </p>
          </div>
        </div>
        <div className="settings-list">
          <div className="settings-row">
            <div className="settings-copy">
              <strong>Backgrounds & surfaces</strong>
              <span>Slate neutrals establish a calm, premium finance-tool foundation.</span>
            </div>
            <span className="tag-badge">Slate</span>
          </div>
          <div className="settings-row">
            <div className="settings-copy">
              <strong>Primary interactions</strong>
              <span>Buttons, active tabs, and interactive emphasis use blue system tones.</span>
            </div>
            <span className="tag-badge">Blue</span>
          </div>
          <div className="settings-row">
            <div className="settings-copy">
              <strong>Secondary emphasis</strong>
              <span>Highlights and supporting accents use amber without turning the UI noisy.</span>
            </div>
            <span className="tag-badge is-amber">Amber</span>
          </div>
          <div className="settings-row">
            <div className="settings-copy">
              <strong>Gain / loss semantics</strong>
              <span>Green and red are reserved for profit, loss, and nothing else.</span>
            </div>
            <span className="value-badge">Semantic only</span>
          </div>
        </div>
      </section>

      <footer className="market-footer">
        <p className="market-footer-text">{marketFooterText}</p>
      </footer>
    </section>
  );
}

export default SettingsPage;
