const express = require("express");

const app = express();
const port = 3000;

app.use(express.json());

let positions = [
  { id: "BTC", name: "Bitcoin", currency: "USD", position: 0.1, price: 70000 },
  { id: "ETH", name: "Ethereum", currency: "USD", position: 1.5, price: 3500 },
  { id: "Cash", name: "Cash", currency: "CNY", position: 10000, price: 1 }
];

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/api/positions", (req, res) => {
  res.json(positions);
});

app.put("/api/positions/:id", (req, res) => {
  const assetId = String(req.params.id || "").trim();
  const nextPosition = Number(req.body && req.body.position);

  if (!assetId) {
    return res.status(400).json({ error: "Asset id is required" });
  }

  if (!Number.isFinite(nextPosition)) {
    return res.status(400).json({ error: "Position must be a finite number" });
  }

  const index = positions.findIndex((item) => item.id === assetId);
  if (index === -1) {
    return res.status(404).json({ error: "Position not found" });
  }

  positions[index] = {
    ...positions[index],
    position: nextPosition,
  };

  return res.json(positions[index]);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
