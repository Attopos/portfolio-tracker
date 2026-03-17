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
  positions: {
    list: "/api/positions",
  },
  transactions: {
    create: "/api/transactions",
    list: "/api/transactions",
  },
};
