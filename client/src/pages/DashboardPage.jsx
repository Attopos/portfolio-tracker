import { useMemo } from "react";
import { useAuth } from "../features/auth/AuthContext.jsx";
import {
  buildMarketFooterText,
  getEffectivePrice,
} from "../features/portfolio/portfolioSelectors.js";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import { formatCurrency } from "../lib/formatters.js";

const PIE_COLORS = [
  "#3b82f6",
  "#60a5fa",
  "#f59e0b",
  "#fbbf24",
  "#93c5fd",
  "#fcd34d",
];

function buildArcPath(cx, cy, radius, startAngle, endAngle) {
  const startX = cx + radius * Math.cos(startAngle);
  const startY = cy + radius * Math.sin(startAngle);
  const endX = cx + radius * Math.cos(endAngle);
  const endY = cy + radius * Math.sin(endAngle);
  const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

  return [
    "M",
    startX.toFixed(3),
    startY.toFixed(3),
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    1,
    endX.toFixed(3),
    endY.toFixed(3),
  ].join(" ");
}

function AssetDetailsTable({ items, totalUsd }) {
  if (!items.length) {
    return <div className="chart-empty">No allocation data</div>;
  }

  return (
    <div className="asset-details-table">
      <div className="asset-details-head">
        <span>Name</span>
        <span>Value/Invested</span>
        <span>Gain</span>
        <span>Allocation</span>
      </div>
      <div className="asset-details-body">
        {items.map((item, index) => {
          const allocation = totalUsd > 0 ? (item.usdValue / totalUsd) * 100 : 0;
          const gainUsd = item.usdValue - item.investedUsd;
          const gainPercent = item.investedUsd > 0 ? (gainUsd / item.investedUsd) * 100 : 0;

          return (
            <article className="asset-detail-row" key={item.id}>
              <div
                className="asset-detail-accent"
                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                aria-hidden="true"
              />
              <div className="asset-detail-name">
                <div className="asset-detail-badge" aria-hidden="true">
                  {item.symbol}
                </div>
                <div className="asset-detail-copy">
                  <strong>{item.name}</strong>
                  <span>
                    {item.symbol} · {item.positionLabel}
                  </span>
                </div>
              </div>
              <div className="asset-detail-metric">
                <strong>{formatCurrency(item.usdValue, "$")}</strong>
                <span>{formatCurrency(item.investedUsd, "$")}</span>
              </div>
              <div className={gainUsd >= 0 ? "asset-detail-gain is-positive" : "asset-detail-gain is-negative"}>
                <strong>{`${gainUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(gainUsd), "$")}`}</strong>
                <span>{`${gainPercent >= 0 ? "+" : "-"}${Math.abs(gainPercent).toFixed(2)}%`}</span>
              </div>
              <div className="asset-detail-allocation">{allocation.toFixed(2)}%</div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function AllocationDonut({ items, totalUsd }) {
  if (!items.length) {
    return <div className="chart-empty">No allocation data</div>;
  }

  let currentAngle = -Math.PI / 2;

  return (
    <div className="allocation-layout">
      <div className="allocation-visual">
        <svg viewBox="0 0 220 220" className="donut-chart" aria-label="Portfolio allocation">
          <circle cx="110" cy="110" r="74" className="donut-track" />
          {items.map((item, index) => {
            const sliceAngle = (item.usdValue / totalUsd) * Math.PI * 2;
            const nextAngle = currentAngle + sliceAngle;
            const path = buildArcPath(110, 110, 74, currentAngle, nextAngle);
            const segment = (
              <path
                key={item.id}
                d={path}
                stroke={PIE_COLORS[index % PIE_COLORS.length]}
                strokeWidth="28"
                strokeLinecap="butt"
                fill="none"
              />
            );
            currentAngle = nextAngle;
            return segment;
          })}
        </svg>
        <div className="donut-center" aria-hidden="true">
          <span>Tracked Value</span>
          <strong>{formatCurrency(totalUsd, "$")}</strong>
        </div>
      </div>
      <div className="allocation-details">
        <AssetDetailsTable items={items} totalUsd={totalUsd} />
      </div>
    </div>
  );
}

function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const {
    cnyPerUsdRate,
    lastMarketSyncAt,
    marketPricesBySymbol,
    marketStatus,
    positions,
  } = usePortfolioWorkspace();

  const allocation = useMemo(() => {
    const items = positions
      .map((item) => {
        const effectivePrice = getEffectivePrice(item, marketPricesBySymbol);
        const quantity = Number(item.position) || 0;
        const entryPrice = Number(item.price) || 0;
        const baseValue = quantity * effectivePrice;
        const baseInvested = quantity * entryPrice;
        const usdValue = item.currency === "CNY" ? baseValue / cnyPerUsdRate : baseValue;
        const investedUsd = item.currency === "CNY" ? baseInvested / cnyPerUsdRate : baseInvested;
        const symbol = String(item.standardSymbol || item.id || item.name || "")
          .trim()
          .toUpperCase()
          .slice(0, 5);
        return {
          id: item.id,
          investedUsd,
          name: item.name,
          positionLabel: `${quantity} ${quantity === 1 ? "share" : "shares"}`,
          symbol: symbol || String(item.name || "").trim().slice(0, 3).toUpperCase(),
          usdValue,
        };
      })
      .filter((item) => item.usdValue > 0)
      .sort((left, right) => right.usdValue - left.usdValue);

    return items.slice(0, 6);
  }, [cnyPerUsdRate, marketPricesBySymbol, positions]);

  const totalUsd = allocation.reduce((sum, item) => sum + item.usdValue, 0);
  const totalCny = totalUsd * cnyPerUsdRate;
  const totalInvestedUsd = allocation.reduce((sum, item) => sum + item.investedUsd, 0);
  const totalProfitUsd = totalUsd - totalInvestedUsd;
  const totalProfitCny = totalProfitUsd * cnyPerUsdRate;
  const totalProfitPercent = totalInvestedUsd > 0 ? (totalProfitUsd / totalInvestedUsd) * 100 : 0;
  const trackedCount = allocation.length;
  const marketFooterText = useMemo(() => {
    return buildMarketFooterText(cnyPerUsdRate, marketPricesBySymbol, lastMarketSyncAt);
  }, [cnyPerUsdRate, lastMarketSyncAt, marketPricesBySymbol]);

  return (
    <section className="page-panel page-panel-detail">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Dashboard</p>
          <h1>Portfolio overview</h1>
          <p className="page-copy">
            {isAuthenticated
              ? "A calm, structured view of portfolio value, performance, and allocation across your tracked assets."
              : "Sign in to see your portfolio totals, allocation mix, and live pricing context."}
          </p>
        </div>
        <div className="page-hero-side">
          <span className="status-badge">Workspace</span>
          <span className="status-badge is-amber">USD/CNY {cnyPerUsdRate.toFixed(4)}</span>
        </div>
      </header>

      <section className="summary-grid" aria-label="Portfolio summary">
        <article className="workspace-card summary-card summary-card-accent">
          <p className="summary-label">Portfolio Value</p>
          <h2 className="summary-value">{formatCurrency(totalCny, "¥")}</h2>
          <p className="summary-support">{formatCurrency(totalUsd, "$")}</p>
        </article>
        <article className="workspace-card summary-card">
          <p className="summary-label">Total Profit</p>
          <div className="profit-summary">
            <h2 className={`profit-value ${totalProfitUsd >= 0 ? "is-positive" : "is-negative"}`}>
              {`${totalProfitUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(totalProfitCny), "¥")}`}
            </h2>
            <span className={`profit-rate ${totalProfitUsd >= 0 ? "is-positive" : "is-negative"}`}>
              {`${totalProfitUsd >= 0 ? "+" : "-"}${Math.abs(totalProfitPercent).toFixed(2)}%`}
            </span>
          </div>
          <p className={`profit-subline ${totalProfitUsd >= 0 ? "is-positive" : "is-negative"}`}>
            {`${totalProfitUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(totalProfitUsd), "$")}`}
            {" "}vs {formatCurrency(totalInvestedUsd, "$")} invested
          </p>
        </article>
        <article className="workspace-card summary-card summary-card-highlight">
          <p className="summary-label">Capital Invested</p>
          <h2 className="summary-value">{formatCurrency(totalInvestedUsd * cnyPerUsdRate, "¥")}</h2>
          <p className="summary-support">{formatCurrency(totalInvestedUsd, "$")} cost basis</p>
        </article>
        <article className="workspace-card summary-card">
          <p className="summary-label">Tracked Assets</p>
          <h2 className="summary-value">{trackedCount}</h2>
          <p className="summary-support">
            {trackedCount === 0 ? "No allocation data yet." : `Top ${trackedCount} assets by portfolio value`}
          </p>
        </article>
      </section>

      <section className="metric-strip" aria-label="Dashboard highlights">
        <div className="metric-pill">
          <span>Live Prices</span>
          <strong>{Object.keys(marketPricesBySymbol).length} synced</strong>
        </div>
        <div className="metric-pill">
          <span>Largest Allocation</span>
          <strong>{allocation[0] ? allocation[0].symbol : "--"}</strong>
        </div>
        <div className="metric-pill">
          <span>Market Sync</span>
          <strong>{lastMarketSyncAt || "Pending"}</strong>
        </div>
      </section>

      <section className="workspace-card chart-card allocation-card" aria-label="Asset allocation">
        <div className="section-head section-head-detail">
          <div>
            <span className="section-kicker">Allocation</span>
            <h2>Asset Allocation</h2>
            <p className="section-subcopy">Portfolio weights and unrealized performance for your top positions.</p>
          </div>
        </div>
        <div className="breakdown-content">
          {!isAuthenticated ? (
            <div className="chart-empty">Sign in to load allocation data.</div>
          ) : (
            <AllocationDonut items={allocation} totalUsd={totalUsd || 1} />
          )}
        </div>
      </section>

      {marketStatus ? <p className="panel-note">{marketStatus}</p> : null}

      <footer className="market-footer">
        <p className="market-footer-text">{marketFooterText}</p>
      </footer>
    </section>
  );
}

export default DashboardPage;
