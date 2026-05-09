function slugifyAssetName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function buildGeneratedAssetId(name) {
  const base = slugifyAssetName(name) || "asset";
  const suffix = Date.now().toString(36).slice(-6);
  return (base + "-" + suffix).slice(0, 48);
}

module.exports = {
  buildGeneratedAssetId,
  slugifyAssetName,
};
