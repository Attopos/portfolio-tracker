import { getAssetIconSrc } from "./assetIcons.js";

const ASSET_CATALOG = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    iconSrc: getAssetIconSrc("BTC"),
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    iconSrc: getAssetIconSrc("ETH"),
  },
  QQQ: {
    symbol: "QQQ",
    name: "Invesco QQQ Trust",
    iconSrc: getAssetIconSrc("QQQ"),
  },
  CASH: {
    symbol: "CASH",
    name: "Cash",
    iconSrc: getAssetIconSrc("CASH"),
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
