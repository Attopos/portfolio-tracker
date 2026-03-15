import { useMemo } from "react";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import { VALUE_FORMATTER, formatCurrency, formatRate } from "../lib/formatters.js";

const HISTORY_RANGES = ["7d", "30d", "90d", "1y"];
const PIE_COLORS = [
  "#22e3a4",
  "#4ba0ff",
  "#ffd166",
  "#f78c6b",
  "#d27aff",
  "#7bdff2",
];

function getEffectivePrice(item, marketPricesBySymbol) {
  const symbol = item?.standardSymbol || "";
  const entryPrice = Number(item?.price);
  const market = symbol ? marketPricesBySymbol[symbol] : null;

  if (market && typeof market === "object") {
    const marketPrice = item.currency === "CNY" ? Number(market.cny) : Number(market.usd);
    if (Number.isFinite(marketPrice) && marketPrice > 0) {
      return marketPrice;
    }
  }

  return Number.isFinite(entryPrice) ? entryPrice : 0;
}

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

function AllocationDonut({ items, totalUsd, totalCny }) {
  if (!items.length) {
    return <div className="chart-empty">No allocation data</div>;
  }

  let currentAngle = -Math.PI / 2;

  return (
    <div className="donut-chart-shell">
      <svg viewBox="0 0 220 220" className="donut-chart" aria-label="Portfolio allocation">
        <circle cx="110" cy="110" r="74" className="donut-track" />
        {items.map((item, index) => {
          const sliceAngle = (item.value / totalUsd) * Math.PI * 2;
          const nextAngle = currentAngle + sliceAngle;
          const path = buildArcPath(110, 110, 74, currentAngle, nextAngle);
          const segment = (
            <path
              key={item.label}
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
      <div className="donut-center">
        <p>Portfolio</p>
        <strong>{formatCurrency(totalCny, "¥")}</strong>
        <span>{formatCurrency(totalUsd, "$")}</span>
      </div>
      <div className="donut-legend">
        {items.map((item, index) => (
          <div className="donut-legend-item" key={item.label}>
            <span
              className="donut-swatch"
              style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
            />
            <span>{item.label}</span>
            <strong>{((item.value / totalUsd) * 100).toFixed(1)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryChart({ points }) {
  if (!points.length) {
    return <div className="history-state">No history data yet.</div>;
  }

  const width = 640;
  const height = 300;
  const padding = 24;
  const values = points.map((point) => Number(point.totalUsd) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, 1);

  const coords = points.map((point, index) => {
    const x =
      padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y =
      height - padding - (((Number(point.totalUsd) || 0) - min) / spread) * (height - padding * 2);
    return [x, y];
  });

  const path = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"} ${coord[0].toFixed(2)} ${coord[1].toFixed(2)}`)
    .join(" ");

  return (
    <div className="history-chart-shell">
      <svg viewBox={`0 0 ${width} ${height}`} className="history-chart-svg" aria-label="Portfolio history">
        <defs>
          <linearGradient id="historyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,227,164,0.32)" />
            <stop offset="100%" stopColor="rgba(34,227,164,0.02)" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L ${coords[coords.length - 1][0].toFixed(2)} ${height - padding} L ${coords[0][0].toFixed(
            2
          )} ${height - padding} Z`}
          fill="url(#historyFill)"
        />
        <path d={path} fill="none" stroke="#22e3a4" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      <div className="history-axis">
        <span>{formatCurrency(min, "$")}</span>
        <span>{formatCurrency(max, "$")}</span>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { isAuthenticated } = useAuth();
  const {
    activeHistoryRange,
    cnyPerUsdRate,
    historyError,
    historyPoints,
    isHistoryLoading,
    lastMarketSyncAt,
    marketPricesBySymbol,
    marketStatus,
    positions,
    refreshHistory,
    transactions,
  } = usePortfolioWorkspace();

  const allocation = useMemo(() => {
    const items = positions
      .map((item) => {
        const effectivePrice = getEffectivePrice(item, marketPricesBySymbol);
        const baseValue = Number(item.position) * effectivePrice;
        const usdValue = item.currency === "CNY" ? baseValue / cnyPerUsdRate : baseValue;
        return {
          label: item.name,
          value: usdValue,
        };
      })
      .filter((item) => item.value > 0)
      .sort((left, right) => right.value - left.value);

    return items.slice(0, 6);
  }, [cnyPerUsdRate, marketPricesBySymbol, positions]);

  const totalUsd = allocation.reduce((sum, item) => sum + item.value, 0);
  const totalCny = totalUsd * cnyPerUsdRate;
  const marketFooterText = useMemo(() => {
    const summaries = Object.keys(marketPricesBySymbol)
      .map((symbol) => {
        const usd = Number(marketPricesBySymbol[symbol]?.usd);
        return Number.isFinite(usd) && usd > 0 ? symbol + " $" + VALUE_FORMATTER.format(usd) : "";
      })
      .filter(Boolean);

    const syncedAt = lastMarketSyncAt ? " | Updated: " + lastMarketSyncAt : "";
    const marketText = summaries.length ? " | " + summaries.join(" | ") : "";
    return "FX USD/CNY: " + formatRate(cnyPerUsdRate) + marketText + syncedAt;
  }, [cnyPerUsdRate, lastMarketSyncAt, marketPricesBySymbol]);

  return (
    <section className="page-panel page-panel-detail">
      <header className="page-hero">
        <p className="page-eyebrow">Dashboard</p>
        <h1>Portfolio Tracker</h1>
        <p className="page-copy">
          {isAuthenticated
            ? "Shared portfolio state now powers the dashboard, holdings, and transactions together."
            : "Sign in to see your allocation, totals, and portfolio history."}
        </p>
      </header>

      <section className="summary-grid" aria-label="Portfolio summary">
        <article className="workspace-card summary-card summary-card-accent">
          <p className="summary-label">Portfolio Value</p>
          <h2>{formatCurrency(totalCny, "¥")}</h2>
          <p>{formatCurrency(totalUsd, "$")}</p>
        </article>
        <article className="workspace-card summary-card">
          <p className="summary-label">Holdings</p>
          <h2>{positions.length}</h2>
          <p>Tracked assets in the current portfolio.</p>
        </article>
        <article className="workspace-card summary-card">
          <p className="summary-label">Transactions</p>
          <h2>{transactions.length}</h2>
          <p>Most recent transaction records currently loaded.</p>
        </article>
      </section>

      <section className="charts-grid" aria-label="Portfolio charts">
        <section className="workspace-card chart-card" aria-label="Asset allocation">
          <div className="section-head section-head-detail">
            <div>
              <h2>Asset Allocation</h2>
            </div>
          </div>
          <div className="breakdown-content">
            {!isAuthenticated ? (
              <div className="chart-empty">Sign in to load allocation data.</div>
            ) : (
              <AllocationDonut items={allocation} totalUsd={totalUsd || 1} totalCny={totalCny} />
            )}
          </div>
        </section>

        <section className="workspace-card history-card chart-card" aria-label="Portfolio value over time">
          <div className="section-head history-head">
            <div>
              <h2>Portfolio Value Over Time</h2>
            </div>
            <div className="history-range-tabs" role="tablist" aria-label="Portfolio history ranges">
              {HISTORY_RANGES.map((range) => (
                <button
                  key={range}
                  className={activeHistoryRange === range ? "history-range-tab is-active" : "history-range-tab"}
                  type="button"
                  aria-selected={activeHistoryRange === range}
                  onClick={() => refreshHistory(range).catch(() => {})}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          {!isAuthenticated ? (
            <div className="history-state">Sign in to load portfolio history.</div>
          ) : isHistoryLoading ? (
            <div className="history-state">Loading history...</div>
          ) : historyError ? (
            <div className="history-state history-state-error">{historyError}</div>
          ) : (
            <HistoryChart points={historyPoints} />
          )}
        </section>
      </section>

      {marketStatus ? <p className="panel-note">{marketStatus}</p> : null}

      <footer className="market-footer">
        <p className="market-footer-text">{marketFooterText}</p>
      </footer>
    </section>
  );
}

export default DashboardPage;
