import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import AssetBadge from "../components/assets/AssetBadge.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import {
  buildPositionMetrics,
} from "../features/portfolio/portfolioMetrics.js";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import {
  POSITION_FORMATTER,
  formatCurrency,
  formatTransactionDate,
} from "../lib/formatters.js";

function AssetDetailPage() {
  const { assetId = "" } = useParams();
  const { isAuthenticated } = useAuth();
  const {
    cnyPerUsdRate,
    marketPricesBySymbol,
    positions,
    transactions,
  } = usePortfolioWorkspace();

  const asset = useMemo(() => {
    return positions.find((item) => item.id === assetId) || null;
  }, [assetId, positions]);

  const detail = useMemo(() => {
    if (!asset) {
      return null;
    }

    return buildPositionMetrics(asset, marketPricesBySymbol, cnyPerUsdRate);
  }, [asset, cnyPerUsdRate, marketPricesBySymbol]);

  const assetTransactions = useMemo(() => {
    if (!detail) {
      return [];
    }

    return transactions.filter((item) => item.assetId === detail.id);
  }, [detail, transactions]);

  if (!isAuthenticated) {
    return (
      <section className="page-panel page-stack">
        <header className="page-hero">
          <div className="page-hero-copy">
            <p className="page-eyebrow">Asset Detail</p>
            <h1>Sign in to inspect asset detail</h1>
            <p className="page-copy">
              Asset-level performance, transaction history, and valuation details are available after sign-in.
            </p>
          </div>
        </header>
      </section>
    );
  }

  if (!detail) {
    return (
      <section className="page-panel page-stack">
        <header className="page-hero">
          <div className="page-hero-copy">
            <p className="page-eyebrow">Asset Detail</p>
            <h1>Asset not found</h1>
            <p className="page-copy">
              The selected asset is not available in the current portfolio workspace.
            </p>
          </div>
          <div className="page-hero-side">
            <Link className="button-ghost" to="/holdings">
              Back to holdings
            </Link>
          </div>
        </header>
      </section>
    );
  }

  return (
    <section className="page-panel page-stack">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Asset Detail</p>
          <h1>{detail.name}</h1>
          <p className="page-copy">
            Position, valuation, and recent transaction activity for this holding.
          </p>
        </div>
        <div className="page-hero-side">
          <AssetBadge className="asset-symbol-badge" symbol={detail.symbol} />
          <span className={detail.currency === "USD" ? "status-badge" : "status-badge is-amber"}>
            {detail.currency}
          </span>
          <Link className="button-ghost" to="/holdings">
            Back to holdings
          </Link>
        </div>
      </header>

      <section className="detail-kpis" aria-label="Asset metrics">
        <article className="workspace-card">
          <p className="summary-label">Market Value</p>
          <h2 className="summary-value">{formatCurrency(detail.usdValue, "$")}</h2>
          <p className="summary-support">{formatCurrency(detail.cnyValue, "¥")}</p>
        </article>
        <article className="workspace-card">
          <p className="summary-label">Unrealized P/L</p>
          <div className="profit-summary">
            <h2 className={`profit-value ${detail.pnlUsd >= 0 ? "is-positive" : "is-negative"}`}>
              {`${detail.pnlUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(detail.pnlUsd), "$")}`}
            </h2>
            <span className={`profit-rate ${detail.pnlUsd >= 0 ? "is-positive" : "is-negative"}`}>
              {`${detail.pnlPercent >= 0 ? "+" : "-"}${Math.abs(detail.pnlPercent).toFixed(2)}%`}
            </span>
          </div>
          <p className="summary-support">{formatCurrency(detail.investedUsd, "$")} invested</p>
        </article>
        <article className="workspace-card">
          <p className="summary-label">Position</p>
          <h2 className="summary-value">{POSITION_FORMATTER.format(detail.position)}</h2>
          <p className="summary-support">Market price {formatCurrency(detail.effectivePrice, detail.currency === "CNY" ? "¥" : "$")}</p>
        </article>
      </section>

      <section className="detail-layout">
        <article className="workspace-card">
          <div className="section-head section-head-detail">
            <div>
              <span className="section-kicker">Overview</span>
              <h2>Holding snapshot</h2>
            </div>
          </div>
          <div className="detail-list">
            <div className="detail-list-row">
              <div className="detail-list-copy">
                <strong>Asset ID</strong>
                <span>Internal holding identifier</span>
              </div>
              <span className="value-badge">{detail.id}</span>
            </div>
            <div className="detail-list-row">
              <div className="detail-list-copy">
                <strong>Entry price</strong>
                <span>Stored basis price for the current position</span>
              </div>
              <strong>{formatCurrency(detail.price, detail.currency === "CNY" ? "¥" : "$")}</strong>
            </div>
            <div className="detail-list-row">
              <div className="detail-list-copy">
                <strong>Market price</strong>
                <span>Live quote when available, otherwise fallback basis price</span>
              </div>
              <strong>{formatCurrency(detail.effectivePrice, detail.currency === "CNY" ? "¥" : "$")}</strong>
            </div>
            <div className="detail-list-row">
              <div className="detail-list-copy">
                <strong>Transaction count</strong>
                <span>Recorded events linked to this asset</span>
              </div>
              <strong>{assetTransactions.length}</strong>
            </div>
          </div>
        </article>

        <aside className="workspace-card">
          <div className="section-head section-head-detail">
            <div>
              <span className="section-kicker">Context</span>
              <h2>Workspace notes</h2>
            </div>
          </div>
          <div className="settings-meta">
            <span className="status-badge">Live pricing</span>
            <p className="settings-note">
              Market values are converted into both USD and CNY using the latest workspace FX rate.
            </p>
            <span className="status-badge is-amber">Dual-currency view</span>
            <p className="settings-note">This page stays focused on the asset itself without adding extra product chrome.</p>
          </div>
        </aside>
      </section>

      <section className="workspace-card table-card" aria-label="Asset transactions">
        <div className="section-head section-head-detail">
          <div>
            <span className="section-kicker">History</span>
            <h2>Recent transactions</h2>
            <p className="section-subcopy">Latest buys and sells associated with this holding.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr className="head-row">
                <th>Date</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Position After</th>
              </tr>
            </thead>
            <tbody>
              {assetTransactions.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="5">No transactions recorded for this asset yet.</td>
                </tr>
              ) : (
                assetTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTransactionDate(item.transactedAt)}</td>
                    <td className="table-text">
                      <span className={item.type === "sell" ? "transaction-badge is-sell" : "transaction-badge"}>
                        {item.type}
                      </span>
                    </td>
                    <td>{POSITION_FORMATTER.format(Number(item.quantity) || 0)}</td>
                    <td>
                      {item.unitPrice === null || item.unitPrice === ""
                        ? "--"
                        : formatCurrency(Number(item.unitPrice) || 0, detail.currency === "CNY" ? "¥" : "$")}
                    </td>
                    <td>{POSITION_FORMATTER.format(Number(item.positionAfter) || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

    </section>
  );
}

export default AssetDetailPage;
