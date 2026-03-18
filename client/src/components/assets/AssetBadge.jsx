import { getAssetCatalogEntry } from "../../config/assetCatalog.js";

function AssetBadge({
  symbol,
  className = "",
  fallbackText,
  alt,
}) {
  const entry = getAssetCatalogEntry(symbol);
  const displayText = String(fallbackText || entry?.symbol || symbol || "")
    .trim()
    .toUpperCase();
  const iconSrc = entry?.iconSrc ? String(entry.iconSrc).trim() : "";
  const label = alt || entry?.name || displayText;
  const classNames = ["asset-badge", className].filter(Boolean).join(" ");

  return (
    <span className={classNames} aria-hidden="true">
      {iconSrc ? (
        <img className="asset-badge-image" src={iconSrc} alt={label} />
      ) : (
        <span className="asset-badge-fallback">{displayText}</span>
      )}
    </span>
  );
}

export default AssetBadge;
