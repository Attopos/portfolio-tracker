import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import {
  POSITION_FORMATTER,
  VALUE_FORMATTER,
  formatCurrency,
  formatRate,
  parseNumberInput,
} from "../lib/formatters.js";

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

function HoldingsPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [formValues, setFormValues] = useState({
    assetName: "",
    currency: "CNY",
    quantity: "",
    unitPrice: "",
  });
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    addHolding,
    cnyPerUsdRate,
    isPositionsLoading,
    lastMarketSyncAt,
    marketPricesBySymbol,
    marketStatus,
    positions,
    positionsError,
  } = usePortfolioWorkspace();

  const isDialogOpen = searchParams.get("action") === "create";

  const rows = useMemo(() => {
    return positions.map((item) => {
      const effectivePrice = getEffectivePrice(item, marketPricesBySymbol);
      const baseValue = item.position * effectivePrice;
      const usdValue = item.currency === "CNY" ? baseValue / cnyPerUsdRate : baseValue;
      const cnyValue = item.currency === "CNY" ? baseValue : usdValue * cnyPerUsdRate;

      return {
        ...item,
        cnyValue,
        effectivePrice,
        usdValue,
      };
    });
  }, [cnyPerUsdRate, marketPricesBySymbol, positions]);

  const totals = useMemo(() => {
    return rows.reduce(
      (accumulator, item) => ({
        usd: accumulator.usd + item.usdValue,
        cny: accumulator.cny + item.cnyValue,
      }),
      { usd: 0, cny: 0 }
    );
  }, [rows]);

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

  function openDialog() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("action", "create");
    setSearchParams(nextParams);
  }

  function closeDialog() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    setSearchParams(nextParams);
    setSubmitError("");
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const assetName = formValues.assetName.trim();
    if (!assetName) {
      setSubmitError("Name is required.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await addHolding({
        assetName,
        currency: formValues.currency === "USD" ? "USD" : "CNY",
        quantity: parseNumberInput(formValues.quantity),
        unitPrice: parseNumberInput(formValues.unitPrice),
      });
      setFormValues({
        assetName: "",
        currency: "CNY",
        quantity: "",
        unitPrice: "",
      });
      closeDialog();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to add holding.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-panel page-panel-detail">
      <section className="page-action-bar" aria-label="Portfolio actions">
        <div className="page-action-widget">
          <button
            className="page-action-trigger"
            type="button"
            aria-expanded={isDialogOpen}
            aria-haspopup="dialog"
            onClick={openDialog}
          >
            + Add holding
          </button>
        </div>
      </section>

      {isDialogOpen ? (
        <div className="page-action-panel" role="presentation" onClick={closeDialog}>
          <section
            className="workspace-card page-action-card"
            role="dialog"
            aria-modal="true"
            aria-label="Add holding"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head section-head-split">
              <div>
                <h2>Add Holding</h2>
                <p>Create a new holding by recording its first position.</p>
              </div>
              <button className="page-action-close" type="button" onClick={closeDialog}>
                ×
              </button>
            </div>
            <form className="create-asset-form" onSubmit={handleSubmit}>
              <div className="create-asset-field">
                <label htmlFor="holding-name">Name</label>
                <input
                  id="holding-name"
                  name="assetName"
                  type="text"
                  required
                  value={formValues.assetName}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="create-asset-field">
                <label htmlFor="holding-currency">Currency</label>
                <select
                  id="holding-currency"
                  name="currency"
                  value={formValues.currency}
                  onChange={handleFieldChange}
                >
                  <option value="CNY">CNY</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div className="create-asset-field">
                <label htmlFor="holding-quantity">Quantity</label>
                <input
                  id="holding-quantity"
                  name="quantity"
                  type="text"
                  inputMode="decimal"
                  required
                  value={formValues.quantity}
                  onChange={handleFieldChange}
                />
              </div>
              <div className="create-asset-field">
                <label htmlFor="holding-price">Entry Price</label>
                <input
                  id="holding-price"
                  name="unitPrice"
                  type="text"
                  inputMode="decimal"
                  required
                  value={formValues.unitPrice}
                  onChange={handleFieldChange}
                />
              </div>
              {submitError ? <p className="form-error">{submitError}</p> : null}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Holding"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <section className="workspace-card portfolio-table-card" aria-label="Holdings">
        <div className="section-head section-head-detail">
          <div>
            <h2>Holdings</h2>
            <p className="section-subcopy">
              {isAuthenticated
                ? "Your current portfolio with live pricing where available."
                : "Sign in to load your portfolio."}
            </p>
          </div>
        </div>

        {positionsError ? <p className="panel-error">{positionsError}</p> : null}
        {marketStatus ? <p className="panel-note">{marketStatus}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr className="head-row">
                <th>Name</th>
                <th>Currency</th>
                <th>Position Size</th>
                <th>Market Price</th>
                <th>Market Value (USD)</th>
                <th>Market Value (CNY)</th>
              </tr>
            </thead>
            <tbody>
              {!isAuthenticated ? (
                <tr className="empty-row">
                  <td colSpan="6">Sign in to load portfolio holdings.</td>
                </tr>
              ) : isPositionsLoading ? (
                <tr className="empty-row">
                  <td colSpan="6">Loading holdings...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="6">No holdings recorded yet.</td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.currency}</td>
                    <td>{POSITION_FORMATTER.format(item.position)}</td>
                    <td className="price">{VALUE_FORMATTER.format(item.effectivePrice)}</td>
                    <td className="usd">{formatCurrency(item.usdValue, "$")}</td>
                    <td className="cny">{formatCurrency(item.cnyValue, "¥")}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="total-row">
                <td>Total</td>
                <td colSpan="3" />
                <td>{formatCurrency(totals.usd, "$")}</td>
                <td>{formatCurrency(totals.cny, "¥")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <footer className="market-footer">
        <p className="market-footer-text">{marketFooterText}</p>
      </footer>
    </section>
  );
}

export default HoldingsPage;
