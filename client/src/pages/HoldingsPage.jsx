import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AssetBadge from "../features/assets/AssetBadge.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import {
  buildPositionMetrics,
} from "../features/portfolio/portfolioMetrics.js";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import {
  POSITION_FORMATTER,
  VALUE_FORMATTER,
  formatCurrency,
  parseNumberInput,
} from "../lib/formatters.js";

function HoldingsPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");
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
    marketPricesBySymbol,
    marketStatus,
    positions,
    positionsError,
  } = usePortfolioWorkspace();

  const isDialogOpen = searchParams.get("action") === "create";

  const rows = useMemo(() => {
    return positions.map((portfolioPosition) =>
      buildPositionMetrics(portfolioPosition, marketPricesBySymbol, cnyPerUsdRate)
    );
  }, [cnyPerUsdRate, marketPricesBySymbol, positions]);

  const filteredRows = useMemo(() => {
    return rows.filter((item) => {
      const matchesCurrency = currencyFilter === "all" ? true : item.currency === currencyFilter;
      const term = searchValue.trim().toLowerCase();
      const matchesSearch = term
        ? item.name.toLowerCase().includes(term) || item.id.toLowerCase().includes(term)
        : true;
      return matchesCurrency && matchesSearch;
    });
  }, [currencyFilter, rows, searchValue]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (accumulator, item) => ({
        usd: accumulator.usd + item.usdValue,
        cny: accumulator.cny + item.cnyValue,
      }),
      { usd: 0, cny: 0 }
    );
  }, [filteredRows]);

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
            <form className="action-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-field">
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
                <div className="form-field">
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
              </div>
              <div className="form-grid">
                <div className="form-field">
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
                <div className="form-field">
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
              </div>
              {submitError ? <p className="form-error">{submitError}</p> : null}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Holding"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <section className="workspace-card table-card" aria-label="Holdings">
        <div className="section-head section-head-detail">
          <div>
            <span className="section-kicker">Portfolio</span>
            <h2>Holdings</h2>
          </div>
          <div className="toolbar-section">
            <span className="value-badge">{filteredRows.length} assets</span>
          </div>
        </div>

        <div className="page-toolbar">
          <div className="toolbar-section">
            <input
              className="filter-input"
              type="search"
              value={searchValue}
              placeholder="Filter by asset name or symbol"
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
          <div className="toolbar-section">
            <div className="tab-row" role="tablist" aria-label="Currency filter">
              {[
                { id: "all", label: "All" },
                { id: "USD", label: "USD" },
                { id: "CNY", label: "CNY" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={currencyFilter === tab.id ? "tab-button is-active" : "tab-button"}
                  type="button"
                  role="tab"
                  aria-selected={currencyFilter === tab.id}
                  onClick={() => setCurrencyFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
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
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {!isAuthenticated ? (
                <tr className="empty-row">
                  <td colSpan="7">Sign in to load portfolio holdings.</td>
                </tr>
              ) : isPositionsLoading ? (
                <tr className="empty-row">
                  <td colSpan="7">Loading holdings...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="7">
                    {rows.length === 0 ? "No holdings recorded yet." : "No holdings match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => (
                  <tr key={item.id}>
                    <td className="table-text">
                      <Link className="table-link" to={`/holdings/${encodeURIComponent(item.id)}`}>
                        <AssetBadge className="asset-symbol-badge" symbol={item.symbol} />
                        <span>
                          {item.name}
                          <span className="table-meta">{item.id}</span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={item.currency === "USD" ? "status-badge" : "status-badge is-amber"}>
                        {item.currency}
                      </span>
                    </td>
                    <td>{POSITION_FORMATTER.format(item.position)}</td>
                    <td className="price">{VALUE_FORMATTER.format(item.effectivePrice)}</td>
                    <td className="usd">{formatCurrency(item.usdValue, "$")}</td>
                    <td className="cny">{formatCurrency(item.cnyValue, "¥")}</td>
                    <td className={item.pnlUsd >= 0 ? "is-positive" : "is-negative"}>
                      {`${item.pnlUsd >= 0 ? "+" : "-"}${formatCurrency(Math.abs(item.pnlUsd), "$")}`}
                      <span className="table-meta">
                        {`${item.pnlPercent >= 0 ? "+" : "-"}${Math.abs(item.pnlPercent).toFixed(2)}%`}
                      </span>
                    </td>
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
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

    </section>
  );
}

export default HoldingsPage;
