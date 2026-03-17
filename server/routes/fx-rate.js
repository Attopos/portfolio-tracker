const express = require("express");
const { requireAuth } = require("../middleware/require-auth");
const { buildFxRateResponse } = require("./portfolio-history");

const router = express.Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const payload = await buildFxRateResponse();
    return res.json({
      ok: true,
      ...payload,
    });
  } catch (error) {
    console.error("Failed to read FX rate:", error);
    return res.status(500).json({ error: "Failed to read FX rate" });
  }
});

module.exports = router;
