import btcIcon from "../../assets/asset-icons/btc.png";
import ethIcon from "../../assets/asset-icons/eth.png";

const ASSET_ICON_MAP = {
  BTC: btcIcon,
  ETH: ethIcon,
};

function normalizeAssetIconKey(value) {
  return String(value || "").trim().toUpperCase();
}

export function getAssetIconSrc(value) {
  const normalized = normalizeAssetIconKey(value);
  return ASSET_ICON_MAP[normalized] || "";
}

export { ASSET_ICON_MAP };
