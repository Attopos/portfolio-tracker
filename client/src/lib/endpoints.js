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
  },
  transactions: {
    create: "/api/transactions",
    list: "/api/transactions",
  },
};
