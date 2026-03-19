import { useEffect, useMemo, useRef, useState } from "react";
import { TrashIcon } from "@heroicons/react/24/outline";
import { Link, useSearchParams } from "react-router-dom";
import AssetBadge from "../features/assets/AssetBadge.jsx";
import {
  getPresetAssets,
} from "../features/assets/assetDatabase.js";
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

function getAutoFilledUnitPrice(asset, currency, marketPricesByAssetSymbol) {
  if (!asset || !asset.symbol) {
    return "";
  }

  const marketPrice = marketPricesByAssetSymbol[asset.symbol];
  if (!marketPrice || typeof marketPrice !== "object") {
    return "";
  }

  const nextPrice = currency === "CNY" ? Number(marketPrice.cny) : Number(marketPrice.usd);
  return Number.isFinite(nextPrice) && nextPrice > 0 ? nextPrice.toFixed(2) : "";
}

function HoldingsPage() {
  const { isAuthenticated } = useAuth();
  const presetAssets = useMemo(() => getPresetAssets(), []);
  const assetPickerRef = useRef(null);
  const previousSelectedAssetIdRef = useRef("");
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [formValues, setFormValues] = useState({
    assetQuery: "",
    assetId: "",
    currency: "CNY",
    quantity: "",
    unitPrice: "",
  });
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deletingAssetId, setDeletingAssetId] = useState("");
  const {
    addHolding,
    cnyPerUsdRate,
    deleteHolding,
    isPositionsLoading,
    marketPricesByAssetSymbol,
    marketStatus,
    positions,
    positionsError,
    transactions,
  } = usePortfolioWorkspace();

  const isDialogOpen = searchParams.get("action") === "create";

  const rows = useMemo(() => {
    return positions.map((portfolioPosition) =>
      buildPositionMetrics(portfolioPosition, marketPricesByAssetSymbol, cnyPerUsdRate)
    );
  }, [cnyPerUsdRate, marketPricesByAssetSymbol, positions]);

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

  const transactionStatsByAssetId = useMemo(() => {
    return transactions.reduce((accumulator, transaction) => {
      const assetId = String(transaction?.assetId || "").trim();
      if (!assetId) {
        return accumulator;
      }

      const current = accumulator[assetId] || { count: 0, hasNonSetTransaction: false };
      current.count += 1;
      current.hasNonSetTransaction = current.hasNonSetTransaction || transaction.type !== "set";
      accumulator[assetId] = current;
      return accumulator;
    }, {});
  }, [transactions]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (accumulator, item) => ({
        usd: accumulator.usd + item.usdValue,
        cny: accumulator.cny + item.cnyValue,
      }),
      { usd: 0, cny: 0 }
    );
  }, [filteredRows]);

  const filteredPresetAssets = useMemo(() => {
    const term = formValues.assetQuery.trim().toLowerCase();
    if (!term) {
      return presetAssets;
    }

    return presetAssets.filter((asset) => {
      return (
        asset.name.toLowerCase().includes(term) ||
        asset.symbol.toLowerCase().includes(term) ||
        asset.category.toLowerCase().includes(term)
      );
    });
  }, [formValues.assetQuery, presetAssets]);

  const selectedPresetAsset = useMemo(() => {
    return presetAssets.find((asset) => asset.id === formValues.assetId) || null;
  }, [formValues.assetId, presetAssets]);

  const autoFilledUnitPrice = useMemo(() => {
    return getAutoFilledUnitPrice(selectedPresetAsset, formValues.currency, marketPricesByAssetSymbol);
  }, [formValues.currency, marketPricesByAssetSymbol, selectedPresetAsset]);

  const isUnitPriceLocked = Boolean(autoFilledUnitPrice);

  useEffect(() => {
    function handlePointerDown(event) {
      if (assetPickerRef.current && !assetPickerRef.current.contains(event.target)) {
        setIsAssetPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  useEffect(() => {
    const previousSelectedAssetId = previousSelectedAssetIdRef.current;
    const selectedAssetId = selectedPresetAsset?.id || "";
    const didAssetChange = previousSelectedAssetId !== selectedAssetId;

    if (!selectedAssetId) {
      previousSelectedAssetIdRef.current = "";
      return;
    }

    if (autoFilledUnitPrice) {
      setFormValues((current) => (
        current.unitPrice === autoFilledUnitPrice
          ? current
          : {
              ...current,
              unitPrice: autoFilledUnitPrice,
            }
      ));
    } else if (didAssetChange) {
      setFormValues((current) => ({
        ...current,
        unitPrice: "",
      }));
    }

    previousSelectedAssetIdRef.current = selectedAssetId;
  }, [autoFilledUnitPrice, selectedPresetAsset]);

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
    setIsAssetPickerOpen(false);
  }

  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFormValues((current) => ({
      ...current,
      assetId: name === "assetQuery" ? "" : current.assetId,
      [name]: value,
    }));
  }

  function handleAssetSelect(asset) {
    setFormValues((current) => ({
      ...current,
      assetId: asset.id,
      assetQuery: asset.name,
    }));
    setIsAssetPickerOpen(false);
    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!selectedPresetAsset) {
      setSubmitError("Please select one asset from the list.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await addHolding({
        assetId: selectedPresetAsset.id,
        assetName: selectedPresetAsset.name,
        currency: formValues.currency === "USD" ? "USD" : "CNY",
        quantity: parseNumberInput(formValues.quantity),
        unitPrice: parseNumberInput(formValues.unitPrice),
      });
      setFormValues({
        assetQuery: "",
        assetId: "",
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

  async function handleDeleteHolding(item) {
    const confirmed = window.confirm(`Delete holding "${item.name}"? This will also remove its transaction history.`);
    if (!confirmed) {
      return;
    }

    setDeletingAssetId(item.id);
    setDeleteError("");

    try {
      await deleteHolding(item.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Failed to delete holding.");
    } finally {
      setDeletingAssetId("");
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
              <div className="form-field form-field-picker" ref={assetPickerRef}>
                <label htmlFor="holding-name">Name <span className="form-required">*</span></label>
                <div className="asset-picker-shell">
                  <input
                    id="holding-name"
                    name="assetQuery"
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Search Bitcoin, Gold, Nasdaq 100..."
                    value={formValues.assetQuery}
                    onChange={handleFieldChange}
                    onFocus={() => setIsAssetPickerOpen(true)}
                  />
                  {isAssetPickerOpen ? (
                    <div className="asset-picker-dropdown" role="listbox" aria-label="Asset results">
                      {filteredPresetAssets.length === 0 ? (
                        <div className="asset-picker-empty">No matching assets.</div>
                      ) : (
                        filteredPresetAssets.map((asset) => {
                          const isSelected = asset.id === formValues.assetId;
                          return (
                            <button
                              key={asset.id}
                              className={isSelected ? "asset-picker-option is-selected" : "asset-picker-option"}
                              type="button"
                              role="option"
                              aria-selected={isSelected}
                              onMouseDown={(event) => {
                                event.preventDefault();
                                handleAssetSelect(asset);
                              }}
                            >
                              <div className="asset-picker-option-main">
                                <AssetBadge className="asset-picker-badge" symbol={asset.symbol} />
                                <div className="asset-picker-copy">
                                  <strong>{asset.name}</strong>
                                  <span>{asset.symbol} · {asset.category}</span>
                                </div>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="holding-currency">Currency <span className="form-required">*</span></label>
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
                  <label htmlFor="holding-quantity">Quantity <span className="form-required">*</span></label>
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
                  <label htmlFor="holding-price">Entry Price <span className="form-required">*</span></label>
                  <input
                    id="holding-price"
                    name="unitPrice"
                    type="text"
                    inputMode="decimal"
                    required
                    disabled={isUnitPriceLocked}
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
        {deleteError ? <p className="panel-error">{deleteError}</p> : null}

        <div className="table-wrap">
          <table className="holdings-table">
            <colgroup>
              <col className="holdings-col-name" />
              <col className="holdings-col-currency" />
              <col className="holdings-col-position" />
              <col className="holdings-col-price" />
              <col className="holdings-col-usd" />
              <col className="holdings-col-cny" />
              <col className="holdings-col-pnl" />
              <col className="holdings-col-actions" />
            </colgroup>
            <thead>
              <tr className="head-row">
                <th>Name</th>
                <th>Currency</th>
                <th>Position Size</th>
                <th>Market Price</th>
                <th>Value USD</th>
                <th>Value CNY</th>
                <th>P/L</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {!isAuthenticated ? (
                <tr className="empty-row">
                  <td colSpan="8">Sign in to load portfolio holdings.</td>
                </tr>
              ) : isPositionsLoading ? (
                <tr className="empty-row">
                  <td colSpan="8">Loading holdings...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan="8">
                    {rows.length === 0 ? "No holdings recorded yet." : "No holdings match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredRows.map((item) => (
                  (() => {
                    const transactionStats = transactionStatsByAssetId[item.id] || null;
                    const isNewHoldingOnly =
                      Boolean(transactionStats) &&
                      transactionStats.count === 1 &&
                      transactionStats.hasNonSetTransaction === false;
                    const pnlValueCny = isNewHoldingOnly ? 0 : item.pnlCny;
                    const pnlPercent = isNewHoldingOnly ? 0 : item.pnlPercent;

                    return (
                  <tr key={item.id}>
                    <td className="table-text">
                      <Link className="table-link" to={`/holdings/${encodeURIComponent(item.id)}`}>
                        <AssetBadge className="asset-symbol-badge" symbol={item.symbol} />
                        <span>
                          {item.name}
                          <span className="table-meta">{item.assetSymbol || item.id}</span>
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
                    <td className={pnlValueCny >= 0 ? "is-positive" : "is-negative"}>
                      {`${pnlValueCny >= 0 ? "+" : "-"}${formatCurrency(Math.abs(pnlValueCny), "¥")}`}
                      <span className="table-meta">
                        {`${pnlPercent >= 0 ? "+" : "-"}${Math.abs(pnlPercent).toFixed(2)}%`}
                      </span>
                    </td>
                    <td className="table-action-cell">
                      <button
                        className="row-delete-button"
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        disabled={deletingAssetId === item.id}
                        onClick={() => handleDeleteHolding(item)}
                      >
                        <TrashIcon aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                    );
                  })()
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
