import { getAssetIconSrc } from "./assetIcons.js";
import assetRegistryData from "./assetRegistryData.json";

const PRESET_ASSETS = assetRegistryData.map((asset) => ({
  ...asset,
  iconSrc: asset.iconKey ? getAssetIconSrc(asset.iconKey) : "",
}));

const PRESET_ASSET_LOOKUP = buildPresetAssetLookup();

function buildPresetAssetLookup() {
  const map = new Map();

  for (let index = 0; index < PRESET_ASSETS.length; index += 1) {
    const asset = PRESET_ASSETS[index];
    const keys = [asset.id, asset.symbol, asset.name, buildPresetAssetLabel(asset), ...(asset.aliases || [])];

    for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      const normalized = normalizeAssetLookupKey(keys[keyIndex]);
      if (normalized) {
        map.set(normalized, asset);
      }
    }
  }

  return map;
}

function normalizeAssetLookupKey(value) {
  return String(value || "").trim().toUpperCase();
}

function buildPresetAssetLabel(asset) {
  return `${asset.name} (${asset.symbol})`;
}

export function getPresetAssets() {
  return PRESET_ASSETS.slice();
}

export function getPresetAssetById(assetId) {
  return PRESET_ASSETS.find((asset) => asset.id === assetId) || null;
}

export function findPresetAsset(value) {
  const normalized = normalizeAssetLookupKey(value);
  return normalized ? PRESET_ASSET_LOOKUP.get(normalized) || null : null;
}

export function getPresetAssetLabel(value) {
  const asset = typeof value === "string" ? findPresetAsset(value) : value;
  return asset ? buildPresetAssetLabel(asset) : "";
}

export function getPresetAssetPresentation(value) {
  const asset = typeof value === "string" ? findPresetAsset(value) : value;
  return asset
    ? {
        symbol: asset.symbol,
        name: asset.name,
        iconSrc: asset.iconSrc,
      }
    : null;
}

export { PRESET_ASSETS };
