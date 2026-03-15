import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createHoldingTransaction,
  createTradeTransaction,
  fetchMarketPrices,
  fetchPortfolioHistory,
  fetchPositions,
  fetchTransactions,
  fetchUsdCnyRate,
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
  const [marketPricesBySymbol, setMarketPricesBySymbol] = useState({});
  const [cnyPerUsdRate, setCnyPerUsdRate] = useState(DEFAULT_CNY_PER_USD);
  const [marketStatus, setMarketStatus] = useState("");
  const [lastMarketSyncAt, setLastMarketSyncAt] = useState("");
  const [activeHistoryRange, setActiveHistoryRange] = useState("30d");
  const [historyPoints, setHistoryPoints] = useState([]);
  const [historyError, setHistoryError] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

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

  async function refreshHistory(range = activeHistoryRange) {
    if (!isAuthenticated) {
      setHistoryPoints([]);
      setHistoryError("");
      return [];
    }

    setIsHistoryLoading(true);
    try {
      const nextPoints = await fetchPortfolioHistory(range);
      setHistoryPoints(nextPoints);
      setHistoryError("");
      setActiveHistoryRange(range);
      return nextPoints;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch portfolio history.";
      setHistoryPoints([]);
      setHistoryError(message);
      setActiveHistoryRange(range);
      throw error;
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function refreshAll() {
    if (!isAuthenticated) {
      setPositions([]);
      setTransactions([]);
      setHistoryPoints([]);
      return;
    }

    await Promise.all([
      refreshPositions(),
      refreshTransactions(),
      refreshHistory(activeHistoryRange),
    ]);
  }

  async function addHolding(payload) {
    await createHoldingTransaction({
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

  useEffect(() => {
    if (!isAuthenticated) {
      setPositions([]);
      setTransactions([]);
      setHistoryPoints([]);
      setPositionsError("");
      setTransactionsError("");
      setHistoryError("");
      return;
    }

    refreshAll().catch(() => {});
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || positions.length === 0) {
      setMarketPricesBySymbol({});
      setMarketStatus("");
      return;
    }

    let cancelled = false;
    const trackedSymbols = positions
      .map((item) => item.standardSymbol || "")
      .filter(Boolean);

    async function refreshMarketData() {
      try {
        const [nextRate, nextPrices] = await Promise.all([
          fetchUsdCnyRate(),
          fetchMarketPrices(trackedSymbols),
        ]);

        if (cancelled) {
          return;
        }

        setCnyPerUsdRate(nextRate);
        setMarketPricesBySymbol(nextPrices);
        setLastMarketSyncAt(new Date().toLocaleString());
        setMarketStatus("");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMarketStatus(error instanceof Error ? error.message : "Failed to refresh market data.");
        setLastMarketSyncAt(new Date().toLocaleString());
      }
    }

    refreshMarketData();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, positions]);

  const value = useMemo(
    () => ({
      activeHistoryRange,
      addHolding,
      addTransaction,
      cnyPerUsdRate,
      historyError,
      historyPoints,
      isHistoryLoading,
      isPositionsLoading,
      isTransactionsLoading,
      lastMarketSyncAt,
      marketPricesBySymbol,
      marketStatus,
      positions,
      positionsError,
      refreshHistory,
      transactions,
      transactionsError,
    }),
    [
      activeHistoryRange,
      cnyPerUsdRate,
      historyError,
      historyPoints,
      isHistoryLoading,
      isPositionsLoading,
      isTransactionsLoading,
      lastMarketSyncAt,
      marketPricesBySymbol,
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
