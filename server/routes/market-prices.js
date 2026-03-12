const express = require("express");
const { fetchCoinGeckoPrices, normalizeRequestedAsset } = require("../services/market-prices");

const router = express.Router();

router.get("/", async (req, res) => {
  const rawAssets = String(req.query.assets || "")
    .split(",")
    .map((value) => normalizeRequestedAsset(value))
    .filter(Boolean);
  const requestedAssets = Array.from(new Set(rawAssets));

  if (requestedAssets.length === 0) {
    return res.json({ ok: true, prices: {}, fetchedAt: new Date().toISOString() });
  }

  try {
    const prices = await fetchCoinGeckoPrices(requestedAssets);
    return res.json({
      ok: true,
      prices,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to load market prices from CoinGecko:", error);
    return res.status(502).json({ error: "Failed to load market prices" });
  }
});

module.exports = router;
