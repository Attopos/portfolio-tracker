import btcIcon from "./icons/btc.svg";
import cac40Icon from "./icons/cac40.svg";
import dax40Icon from "./icons/dax40.svg";
import ethIcon from "./icons/eth.svg";
import goldIcon from "./icons/gold.svg";
import nasdaq100Icon from "./icons/nasdaq100.svg";
import nikkei225Icon from "./icons/nikkei225.svg";
import sp500Icon from "./icons/S&P500.svg";

const ASSET_ICON_MAP = {
  BTC: btcIcon,
  CAC: cac40Icon,
  CAC40: cac40Icon,
  ETH: ethIcon,
  QQQ: nasdaq100Icon,
  NASDAQ: nasdaq100Icon,
  NASDAQ100: nasdaq100Icon,
  DAX: dax40Icon,
  DAX40: dax40Icon,
  NIKKEI: nikkei225Icon,
  NIKKEI225: nikkei225Icon,
  N225: nikkei225Icon,
  GOLD: goldIcon,
  XAU: goldIcon,
  SPX: sp500Icon,
  "S&P500": sp500Icon,
  SP500: sp500Icon,
};

function normalizeAssetIconKey(value) {
  return String(value || "").trim().toUpperCase();
}

export function getAssetIconSrc(value) {
  const normalized = normalizeAssetIconKey(value);
  return ASSET_ICON_MAP[normalized] || "";
}

export { ASSET_ICON_MAP };
