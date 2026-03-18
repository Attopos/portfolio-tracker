const ASSET_CATALOG = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    iconSrc: "",
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    iconSrc: "",
  },
  QQQ: {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    iconSrc: "",
  },
  CASH: {
    symbol: "CASH",
    name: "Cash",
    iconSrc: "",
  },
};

function normalizeAssetKey(value) {
  return String(value || "").trim().toUpperCase();
}

export function getAssetCatalogEntry(value) {
  const normalized = normalizeAssetKey(value);
  return ASSET_CATALOG[normalized] || null;
}

export { ASSET_CATALOG };
