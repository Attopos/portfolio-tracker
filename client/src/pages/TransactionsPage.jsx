import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { buildMarketFooterText } from "../features/portfolio/portfolioSelectors.js";
import { usePortfolioWorkspace } from "../features/portfolio/PortfolioWorkspaceContext.jsx";
import {
  POSITION_FORMATTER,
  VALUE_FORMATTER,
  formatTransactionDate,
  parseNumberInput,
  toDateTimeLocalValue,
} from "../lib/formatters.js";

function TransactionsPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [formValues, setFormValues] = useState({
    type: "buy",
    assetId: "",
    quantity: "",
    unitPrice: "",
    transactedAt: toDateTimeLocalValue(),
  });
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    addTransaction,
    cnyPerUsdRate,
    isTransactionsLoading,
    lastMarketSyncAt,
    marketPricesBySymbol,
    positions,
    transactions,
    transactionsError,
  } = usePortfolioWorkspace();

  const isDialogOpen = searchParams.get("action") === "transaction";

  const marketFooterText = useMemo(() => {
    return buildMarketFooterText(cnyPerUsdRate, marketPricesBySymbol, lastMarketSyncAt);
  }, [cnyPerUsdRate, lastMarketSyncAt, marketPricesBySymbol]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((item) => {
      const matchesType = typeFilter === "all" ? true : item.type === typeFilter;
      const term = searchValue.trim().toLowerCase();
      const assetName = String(item.assetName || item.assetId || "").toLowerCase();
      return matchesType && (term ? assetName.includes(term) : true);
    });
  }, [searchValue, transactions, typeFilter]);

  function openDialog() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("action", "transaction");
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

    if (!formValues.assetId) {
      setSubmitError("Please select a holding first.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await addTransaction({
        type: formValues.type,
        assetId: formValues.assetId,
        quantity: parseNumberInput(formValues.quantity),
        unitPrice: formValues.unitPrice.trim() ? parseNumberInput(formValues.unitPrice) : "",
        transactedAt: formValues.transactedAt,
      });
      setFormValues({
        type: "buy",
        assetId: "",
        quantity: "",
        unitPrice: "",
        transactedAt: toDateTimeLocalValue(),
      });
      closeDialog();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to record transaction.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-panel page-panel-detail">
      <section className="page-action-bar" aria-label="Transaction actions">
        <div className="page-action-widget">
          <button
            className="page-action-trigger"
            type="button"
            aria-expanded={isDialogOpen}
            aria-haspopup="dialog"
            onClick={openDialog}
          >
            + New trade
          </button>
        </div>
      </section>

      {isDialogOpen ? (
        <div className="page-action-panel" role="presentation" onClick={closeDialog}>
          <section
            className="workspace-card page-action-card"
            role="dialog"
            aria-modal="true"
            aria-label="Add transaction"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-head section-head-split">
              <div>
                <h2>Record Transaction</h2>
                <p>Add a buy or sell against one of your current holdings.</p>
              </div>
              <button className="page-action-close" type="button" onClick={closeDialog}>
                ×
              </button>
            </div>
            <form className="transaction-form" onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="transaction-field">
                  <label htmlFor="transaction-type">Type</label>
                  <select
                    id="transaction-type"
                    name="type"
                    value={formValues.type}
                    onChange={handleFieldChange}
                  >
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
                <div className="transaction-field">
                  <label htmlFor="transaction-asset">Asset</label>
                  <select
                    id="transaction-asset"
                    name="assetId"
                    value={formValues.assetId}
                    onChange={handleFieldChange}
                  >
                    <option value="">Select a holding...</option>
                    {positions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="transaction-field">
                  <label htmlFor="transaction-quantity">Quantity</label>
                  <input
                    id="transaction-quantity"
                    name="quantity"
                    type="text"
                    inputMode="decimal"
                    required
                    value={formValues.quantity}
                    onChange={handleFieldChange}
                  />
                </div>
                <div className="transaction-field">
                  <label htmlFor="transaction-price">Entry Price</label>
                  <input
                    id="transaction-price"
                    name="unitPrice"
                    type="text"
                    inputMode="decimal"
                    placeholder="Optional"
                    value={formValues.unitPrice}
                    onChange={handleFieldChange}
                  />
                </div>
              </div>
              <div className="transaction-field">
                <label htmlFor="transaction-date">Date</label>
                <input
                  id="transaction-date"
                  name="transactedAt"
                  type="datetime-local"
                  value={formValues.transactedAt}
                  onChange={handleFieldChange}
                />
              </div>
              {submitError ? <p className="form-error">{submitError}</p> : null}
              <button type="submit" disabled={isSubmitting || positions.length === 0}>
                {isSubmitting ? "Recording..." : "Record Transaction"}
              </button>
            </form>
          </section>
        </div>
      ) : null}

      <header className="page-hero">
        <div className="page-hero-copy">
          <p className="page-eyebrow">Transactions</p>
          <h1>Trade history</h1>
          <p className="page-copy">
            Review buys and sells with a cleaner ledger view, quick filtering, and position context.
          </p>
        </div>
      </header>

      <section className="workspace-card table-card transactions-card" aria-label="Recent transactions">
        <div className="section-head section-head-detail">
          <div>
            <span className="section-kicker">Ledger</span>
            <h2>Recent Transactions</h2>
            <p className="section-subcopy">
              {isAuthenticated
                ? "Your latest buys and sells, with running position totals."
                : "Sign in to load transactions."}
            </p>
          </div>
          <div className="toolbar-section">
            <span className="value-badge">{filteredTransactions.length} rows</span>
          </div>
        </div>

        <div className="page-toolbar">
          <div className="toolbar-section">
            <input
              className="filter-input"
              type="search"
              value={searchValue}
              placeholder="Filter by asset"
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </div>
          <div className="toolbar-section">
            <div className="tab-row" role="tablist" aria-label="Transaction type filter">
              {[
                { id: "all", label: "All" },
                { id: "buy", label: "Buy" },
                { id: "sell", label: "Sell" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={typeFilter === tab.id ? "tab-button is-active" : "tab-button"}
                  type="button"
                  role="tab"
                  aria-selected={typeFilter === tab.id}
                  onClick={() => setTypeFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {transactionsError ? <p className="panel-error">{transactionsError}</p> : null}

        <div className="table-wrap">
          <table>
            <thead>
              <tr className="head-row">
                <th>Date</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Quantity</th>
                <th>Entry Price</th>
                <th>Position After</th>
              </tr>
            </thead>
            <tbody>
              {!isAuthenticated ? (
                <tr className="empty-row">
                  <td colSpan="6">Sign in to load recent transactions.</td>
                </tr>
              ) : isTransactionsLoading ? (
                <tr className="empty-row">
                  <td colSpan="6">Loading transactions...</td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="6">
                    {transactions.length === 0
                      ? "No transactions recorded yet."
                      : "No transactions match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((item) => (
                  <tr key={item.id}>
                    <td>{formatTransactionDate(item.transactedAt)}</td>
                    <td className="table-text">
                      <span className={item.type === "sell" ? "transaction-badge is-sell" : "transaction-badge"}>
                        {item.type}
                      </span>
                    </td>
                    <td className="table-text">{item.assetName || item.assetId}</td>
                    <td>{POSITION_FORMATTER.format(Number(item.quantity) || 0)}</td>
                    <td>
                      {item.unitPrice === null || item.unitPrice === ""
                        ? "--"
                        : VALUE_FORMATTER.format(Number(item.unitPrice) || 0)}
                    </td>
                    <td>{POSITION_FORMATTER.format(Number(item.positionAfter) || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="market-footer">
        <p className="market-footer-text">{marketFooterText}</p>
      </footer>
    </section>
  );
}

export default TransactionsPage;
