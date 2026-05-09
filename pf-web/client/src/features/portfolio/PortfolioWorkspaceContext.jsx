import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createHoldingTransaction,
  createTradeTransaction,
  deleteHolding as deleteHoldingRequest,
  deleteTransaction as deleteTransactionRequest,
  fetchPortfolioDailySummary,
  fetchMarketPrices,
  fetchPositions,
  fetchTransactions,
  fetchUsdCnyRate,
  updateHolding as updateHoldingRequest,
} from "./portfolioApi.js";

const DEFAULT_CNY_PER_USD = 6.91;
const PortfolioWorkspaceContext = createContext(null);

export function PortfolioWorkspaceProvider({ children, isAuthenticated }) {
  const [positions, setPositions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [positionsError, setPositionsError] = useState("");
  const [transactionsError, setTransactionsError] = useState("");
  const [isPositionsLoading, setIsPositionsLoading] = useState(false);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(false);
  const [marketPricesByAssetSymbol, setMarketPricesByAssetSymbol] = useState({});
  const [cnyPerUsdRate, setCnyPerUsdRate] = useState(DEFAULT_CNY_PER_USD);
  const [dailySummary, setDailySummary] = useState(null);
  const [marketStatus, setMarketStatus] = useState("");

  async function refreshPositions() {
    if (!isAuthenticated) {
      setPositions([]);
      setPositionsError("");
      return [];
    }

    setIsPositionsLoading(true);
    try {
      const nextPositions = await fetchPositions();
      setPositions(nextPositions);
      setPositionsError("");
      return nextPositions;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch positions.";
      setPositions([]);
      setPositionsError(message);
      throw error;
    } finally {
      setIsPositionsLoading(false);
    }
  }

  async function refreshTransactions() {
    if (!isAuthenticated) {
      setTransactions([]);
      setTransactionsError("");
      return [];
    }

    setIsTransactionsLoading(true);
    try {
      const nextTransactions = await fetchTransactions();
      setTransactions(nextTransactions);
      setTransactionsError("");
      return nextTransactions;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch transactions.";
      setTransactions([]);
      setTransactionsError(message);
      throw error;
    } finally {
      setIsTransactionsLoading(false);
    }
  }

  async function refreshAll() {
    if (!isAuthenticated) {
      setPositions([]);
      setTransactions([]);
      return;
    }

    await Promise.all([refreshPositions(), refreshTransactions()]);
  }

  async function addHolding(payload) {
    await createHoldingTransaction({
      assetId: payload.assetId,
      assetName: payload.assetName,
      currency: payload.currency,
      type: "set",
      quantity: payload.quantity,
      unitPrice: payload.unitPrice,
    });
    await refreshAll();
  }

  async function addTransaction(payload) {
    await createTradeTransaction(payload);
    await refreshAll();
  }

  async function deleteHolding(assetId) {
    await deleteHoldingRequest(assetId);
    await refreshAll();
  }

  async function updateHolding(assetId, payload) {
    await updateHoldingRequest(assetId, payload);
    await refreshAll();
  }

  async function deleteTransaction(transactionId) {
    await deleteTransactionRequest(transactionId);
    await refreshAll();
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setPositions([]);
      setTransactions([]);
      setPositionsError("");
      setTransactionsError("");
      return;
    }

    refreshAll().catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || positions.length === 0) {
      setMarketPricesByAssetSymbol({});
      setDailySummary(null);
      setMarketStatus("");
      return;
    }

    let cancelled = false;
    const trackedAssetSymbols = positions
      .map((item) => item.assetSymbol || "")
      .filter(Boolean);

    async function refreshMarketData() {
      const [rateResult, pricesResult, dailySummaryResult] = await Promise.allSettled([
        fetchUsdCnyRate(),
        fetchMarketPrices(trackedAssetSymbols),
        fetchPortfolioDailySummary(),
      ]);

      if (cancelled) {
        return;
      }

      if (rateResult.status === "fulfilled") {
        setCnyPerUsdRate(rateResult.value);
      }

      if (pricesResult.status === "fulfilled") {
        setMarketPricesByAssetSymbol(pricesResult.value);
      } else {
        setMarketPricesByAssetSymbol({});
      }

      if (dailySummaryResult.status === "fulfilled") {
        setDailySummary(dailySummaryResult.value);
      } else {
        setDailySummary(null);
      }

      const failures = [rateResult, pricesResult, dailySummaryResult]
        .filter((result) => result.status === "rejected")
        .map((result) => {
          return result.reason instanceof Error ? result.reason.message : "Failed to refresh market data.";
        });

      if (failures.length > 0) {
        setMarketStatus(failures[0]);
      } else {
        setMarketStatus("");
      }
    }

    refreshMarketData().catch((error) => {
      if (cancelled) {
        return;
      }

      setDailySummary(null);
      setMarketPricesByAssetSymbol({});
      setMarketStatus(error instanceof Error ? error.message : "Failed to refresh market data.");
    });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, positions]);

  const value = useMemo(
    () => ({
      addHolding,
      addTransaction,
      deleteHolding,
      deleteTransaction,
      updateHolding,
      cnyPerUsdRate,
      dailySummary,
      isPositionsLoading,
      isTransactionsLoading,
      marketPricesByAssetSymbol,
      marketStatus,
      positions,
      positionsError,
      transactions,
      transactionsError,
    }),
    [
      cnyPerUsdRate,
      dailySummary,
      deleteHolding,
      deleteTransaction,
      updateHolding,
      isPositionsLoading,
      isTransactionsLoading,
      marketPricesByAssetSymbol,
      marketStatus,
      positions,
      positionsError,
      transactions,
      transactionsError,
    ]
  );

  return (
    <PortfolioWorkspaceContext.Provider value={value}>
      {children}
    </PortfolioWorkspaceContext.Provider>
  );
}

export function usePortfolioWorkspace() {
  const context = useContext(PortfolioWorkspaceContext);
  if (!context) {
    throw new Error("usePortfolioWorkspace must be used inside PortfolioWorkspaceProvider.");
  }
  return context;
}
