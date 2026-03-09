const express = require("express");
const cors = require("cors");
require("dotenv").config();
const positionsRouter = require("./routes/positions");

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.use("/api/positions", positionsRouter);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
