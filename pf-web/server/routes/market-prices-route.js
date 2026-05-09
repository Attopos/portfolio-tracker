const express = require("express");
const { fetchMarketPrices, normalizeMarketAssetSymbol } = require("../services/market-price-service");
const { requireAuth } = require("../middleware/require-auth");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  const rawAssets = String(req.query.assets || "")
    .split(",")
    .map((value) => normalizeMarketAssetSymbol(value))
    .filter(Boolean);
  const requestedAssets = Array.from(new Set(rawAssets));

  if (requestedAssets.length === 0) {
    return res.json({ ok: true, prices: {}, fetchedAt: new Date().toISOString() });
  }

  try {
    const prices = await fetchMarketPrices(requestedAssets);
    return res.json({
      ok: true,
      prices,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load market prices:", error);
    return res.status(502).json({ error: "Failed to load market prices" });
  }
});

module.exports = router;
