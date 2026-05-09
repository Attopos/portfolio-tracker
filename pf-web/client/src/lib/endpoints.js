export const API_ROUTES = {
  auth: {
    googleSignIn: "/api/auth/google",
    logout: "/api/auth/logout",
    me: "/api/me",
  },
  fxRate: {
    current: "/api/fx-rate",
  },
  marketPrices: {
    list: "/api/market-prices",
  },
  portfolioHistory: {
    summary: "/api/portfolio-history/summary",
  },
  positions: {
    list: "/api/positions",
    update: (assetId) => `/api/positions/${encodeURIComponent(assetId)}`,
    delete: (assetId) => `/api/positions/${encodeURIComponent(assetId)}`,
  },
  transactions: {
    create: "/api/transactions",
    list: "/api/transactions",
    delete: (transactionId) => `/api/transactions/${encodeURIComponent(transactionId)}`,
  },
};
