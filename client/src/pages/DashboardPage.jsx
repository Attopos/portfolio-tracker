import { useMemo } from "react";
import { ArrowTrendingUpIcon, WalletIcon } from "@heroicons/react/24/outline";
import SummaryCard from "../components/cards/SummaryCard.jsx";
import AssetBadge from "../features/assets/AssetBadge.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import {
  buildPositionMetrics,
} from "../features/portfolio/portfolioMetrics.js";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import { formatCurrency } from "../lib/formatters.js";

const PIE_COLORS = [
  "#c5ff47",
  "#8fdc4f",
  "#62d88b",
  "#3fb8a2",
  "#6e9e58",
  "#adcaa0",
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
                <AssetBadge className="asset-detail-badge" symbol={item.symbol} />
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
                strokeWidth="55"
                strokeLinecap="butt"
                fill="none"
              />
            );
            currentAngle = nextAngle;
            return segment;
          })}
        </svg>
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
    dailySummary,
    marketPricesBySymbol,
    positions,
  } = usePortfolioWorkspace();

  const allocation = useMemo(() => {
    const portfolioSlice = positions
      .map((position) => buildPositionMetrics(position, marketPricesBySymbol, cnyPerUsdRate))
      .map((positionMetrics) => ({
        id: positionMetrics.id,
        investedUsd: positionMetrics.investedUsd,
        name: positionMetrics.name,
        positionLabel: `${positionMetrics.quantity} ${positionMetrics.quantity === 1 ? "share" : "shares"}`,
        symbol: positionMetrics.symbol,
        usdValue: positionMetrics.usdValue,
      }))
      .filter((positionMetrics) => positionMetrics.usdValue > 0)
      .sort((left, right) => right.usdValue - left.usdValue);

    return portfolioSlice.slice(0, 6);
  }, [cnyPerUsdRate, marketPricesBySymbol, positions]);

  const totalUsd = allocation.reduce((sum, item) => sum + item.usdValue, 0);
  const totalCny = totalUsd * cnyPerUsdRate;
  const totalInvestedUsd = allocation.reduce((sum, item) => sum + item.investedUsd, 0);
  const totalProfitUsd = totalUsd - totalInvestedUsd;
  const totalProfitCny = totalProfitUsd * cnyPerUsdRate;
  const totalDailyPnlUsd = Number(dailySummary?.dailyPnlUsd) || 0;
  const totalDailyPnlPercent = Number(dailySummary?.dailyPnlPct) || 0;
  const isDailyPositive = totalDailyPnlUsd >= 0;

  return (
    <section className="page-panel page-panel-detail">
      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Dashboard</p>
          <h1>Portfolio overview</h1>
        </div>
      </header>

      <section className="summary-grid summary-grid-compact" aria-label="Portfolio summary">
        <SummaryCard
          label="Value"
          icon={WalletIcon}
          tone="accent"
          footer={formatCurrency(totalUsd, "$")}
        >
          <h2 className="summary-value">{formatCurrency(totalCny, "¥")}</h2>
        </SummaryCard>
        <SummaryCard
          label="Total Profit"
          icon={ArrowTrendingUpIcon}
          tone="highlight"
          footer={(
            <>
              <span className={`summary-daily-change-arrow ${isDailyPositive ? "is-up" : "is-down"}`} aria-hidden="true" />
              <span className="summary-daily-change-value">
                {`${totalDailyPnlUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(totalDailyPnlUsd), "$")}`}
              </span>
              <span className="summary-daily-change-label">
                daily
              </span>
            </>
          )}
          footerClassName={`summary-daily-change ${isDailyPositive ? "is-positive" : "is-negative"}`}
        >
          <div className="summary-card-main">
            <h2 className={`summary-card-value ${totalProfitUsd >= 0 ? "is-positive" : "is-negative"}`}>
              {`${totalProfitUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(totalProfitCny), "¥")}`}
            </h2>
            <span className={`summary-card-rate ${isDailyPositive ? "is-positive" : "is-negative"}`}>
              {`${totalDailyPnlPercent >= 0 ? "+" : "-"}${Math.abs(totalDailyPnlPercent).toFixed(2)}%`}
            </span>
          </div>
        </SummaryCard>
      </section>

      <section className="workspace-card chart-card allocation-card" aria-label="Asset allocation">
        <div className="breakdown-content">
          {!isAuthenticated ? (
            <div className="chart-empty">Sign in to load allocation data.</div>
          ) : (
            <AllocationDonut items={allocation} totalUsd={totalUsd || 1} />
          )}
        </div>
      </section>
    </section>
  );
}

export default DashboardPage;
