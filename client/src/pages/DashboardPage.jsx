import { useMemo } from "react";
import { ArrowTrendingUpIcon, WalletIcon } from "@heroicons/react/24/outline";
import SummaryCard from "../components/cards/SummaryCard.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import {
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
    marketPricesBySymbol,
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
        const market = item.standardSymbol ? marketPricesBySymbol[item.standardSymbol] : null;
        const dailyChangePercent = market && typeof market === "object"
          ? Number(item.currency === "CNY" ? market.cny24hChange : market.usd24hChange)
          : NaN;
        const symbol = String(item.standardSymbol || item.id || item.name || "")
          .trim()
          .toUpperCase()
          .slice(0, 5);
        return {
          dailyChangePercent: Number.isFinite(dailyChangePercent) ? dailyChangePercent : 0,
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
  const totalDailyChangePercent = totalUsd > 0
    ? allocation.reduce((sum, item) => sum + item.usdValue * (item.dailyChangePercent / 100), 0) / totalUsd * 100
    : 0;
  const isDailyPositive = totalDailyChangePercent >= 0;

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
                {`${Math.abs(totalDailyChangePercent).toFixed(2)}%`}
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
            <span className={`summary-card-rate ${totalProfitUsd >= 0 ? "is-positive" : "is-negative"}`}>
              {`${totalProfitUsd >= 0 ? "+" : "-"}${Math.abs(totalProfitPercent).toFixed(2)}%`}
            </span>
          </div>
        </SummaryCard>
      </section>

      <section className="workspace-card chart-card allocation-card" aria-label="Asset allocation">
        <div className="section-head section-head-detail">
        </div>
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
