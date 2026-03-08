const STORAGE_KEY = "portfolioDataV1";
const MARKET_FEED_STORAGE_KEY = "portfolioMarketFeedV1";
const CNY_SWAP_MIGRATION_KEY = "portfolioCnySwapMigratedV1";
const DEFAULT_CNY_PER_USD = 6.91;
const MARKET_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MIN_MARKET_REQUEST_GAP_MS = 30 * 1000;
const MARKET_RETRY_BASE_MS = 60 * 1000;
const MARKET_RETRY_MAX_MS = 30 * 60 * 1000;
const COINGECKO_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd,cny";
const FX_RATE_API_URL = "https://api.frankfurter.app/latest?from=USD&to=CNY";
const CRYPTO_ASSET_IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  BNB: "binancecoin",
};
const PIE_COLORS = [
  "#22e3a4",
  "#4ba0ff",
  "#ffd166",
  "#f78c6b",
  "#d27aff",
  "#7bdff2",
  "#90f18d",
  "#f7a8b8",
  "#ffa94d",
  "#8ecae6",
];
const POSITION_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});
const VALUE_FORMATTER = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
let cnyPerUsdRate = DEFAULT_CNY_PER_USD;
let latestCryptoQuotes = {};
let lastMarketSyncAt = "";
let lastMarketRequestAt = 0;
let marketConsecutiveFailures = 0;
let marketRefreshTimerId = null;
let marketRefreshInFlight = false;

function parseCurrencyNumber(text) {
  const cleaned = (text || "").replace(/[^\d.-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function getDataRows() {
  const rows = document.querySelectorAll("table tr");
  const dataRows = [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i].querySelector(".usd") && rows[i].querySelector(".cny")) {
      dataRows.push(rows[i]);
    }
  }

  return dataRows;
}

function getRowId(row) {
  const firstCell = row.querySelector("td");
  return firstCell ? firstCell.textContent.trim() : "";
}

function getRowByAssetId(assetId) {
  const rows = getDataRows();

  for (let i = 0; i < rows.length; i++) {
    if (getRowId(rows[i]) === assetId) {
      return rows[i];
    }
  }

  return null;
}

function formatCurrency(value, symbol) {
  return symbol + VALUE_FORMATTER.format(value);
}

function setCryptoStatus(message, isError) {
  const statusEl = document.getElementById("marketUpdateStatus");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.classList.toggle("error", Boolean(isError));
}

function formatRate(value) {
  return Number.isFinite(value) ? value.toFixed(4) : "--";
}

function formatQuotePair(quote) {
  if (!quote || !Number.isFinite(quote.usd) || !Number.isFinite(quote.cny)) {
    return "--";
  }

  return "$" + VALUE_FORMATTER.format(quote.usd) + " / ¥" + VALUE_FORMATTER.format(quote.cny);
}

function renderMarketDataFooter() {
  const footerEl = document.getElementById("marketDataFooter");
  if (!footerEl) {
    return;
  }

  const btc = latestCryptoQuotes.bitcoin;
  const eth = latestCryptoQuotes.ethereum;
  const bnb = latestCryptoQuotes.binancecoin;

  footerEl.textContent =
    "FX USD/CNY: " +
    formatRate(cnyPerUsdRate) +
    " | BTC: " +
    formatQuotePair(btc) +
    " | ETH: " +
    formatQuotePair(eth) +
    " | BNB: " +
    formatQuotePair(bnb) +
    " | Updated: " +
    (lastMarketSyncAt || "--");
}

function saveMarketFeedSnapshot() {
  const snapshot = {
    cnyPerUsdRate,
    latestCryptoQuotes,
    lastMarketSyncAt,
    lastMarketRequestAt,
  };

  localStorage.setItem(MARKET_FEED_STORAGE_KEY, JSON.stringify(snapshot));
}

function restoreMarketFeedSnapshot() {
  const raw = localStorage.getItem(MARKET_FEED_STORAGE_KEY);
  if (!raw) {
    return;
  }

  try {
    const snapshot = JSON.parse(raw);
    const parsedRate = Number(snapshot.cnyPerUsdRate);

    if (Number.isFinite(parsedRate) && parsedRate > 0) {
      cnyPerUsdRate = parsedRate;
    }

    if (snapshot.latestCryptoQuotes && typeof snapshot.latestCryptoQuotes === "object") {
      latestCryptoQuotes = snapshot.latestCryptoQuotes;
    }

    if (typeof snapshot.lastMarketSyncAt === "string") {
      lastMarketSyncAt = snapshot.lastMarketSyncAt;
    }

    const parsedLastRequestAt = Number(snapshot.lastMarketRequestAt);
    if (Number.isFinite(parsedLastRequestAt) && parsedLastRequestAt > 0) {
      lastMarketRequestAt = parsedLastRequestAt;
    }
  } catch (error) {
    console.error("Saved market feed data is invalid JSON:", error);
  }
}

function getSelectedPriceForRow(row, quote) {
  const currencySelect = row.querySelector(".currency-select");
  if (!currencySelect) {
    return quote.usd;
  }

  if (currencySelect.value === "CNY") {
    return quote.cny;
  }

  return quote.usd;
}

function applyQuoteToRowPrice(row, quote) {
  const priceCell = row.querySelector(".price");
  if (!priceCell) {
    return false;
  }

  if (document.activeElement === priceCell) {
    return false;
  }

  const priceValue = getSelectedPriceForRow(row, quote);
  priceCell.textContent = VALUE_FORMATTER.format(priceValue);
  return true;
}

function applyLatestQuoteForRowIfCrypto(row) {
  const rowId = getRowId(row);
  const quoteId = CRYPTO_ASSET_IDS[rowId];
  if (!quoteId) {
    return false;
  }

  const quote = latestCryptoQuotes[quoteId];
  if (!quote || !Number.isFinite(quote.usd) || !Number.isFinite(quote.cny)) {
    return false;
  }

  return applyQuoteToRowPrice(row, quote);
}

async function refreshCryptoPrices() {
  const response = await fetch(COINGECKO_SIMPLE_PRICE_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("CoinGecko HTTP " + response.status);
  }

  const payload = await response.json();
  const normalizedQuotes = {};

  for (const rowId in CRYPTO_ASSET_IDS) {
    const quoteId = CRYPTO_ASSET_IDS[rowId];
    const quoteData = payload[quoteId];

    if (!quoteData) {
      continue;
    }

    const usd = Number(quoteData.usd);
    const cny = Number(quoteData.cny);

    if (!Number.isFinite(usd) || !Number.isFinite(cny)) {
      continue;
    }

    normalizedQuotes[quoteId] = { usd, cny };
  }

  return normalizedQuotes;
}

async function refreshUsdCnyRate() {
  const response = await fetch(FX_RATE_API_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("FX API HTTP " + response.status);
  }

  const payload = await response.json();
  const rate = Number(payload && payload.rates && payload.rates.CNY);

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("FX API invalid rate payload");
  }

  return rate;
}

function applyCryptoQuotesToRows() {
  let changed = false;

  for (const rowId in CRYPTO_ASSET_IDS) {
    const quoteId = CRYPTO_ASSET_IDS[rowId];
    const quote = latestCryptoQuotes[quoteId];
    if (!quote) {
      continue;
    }

    const row = getRowByAssetId(rowId);
    if (!row) {
      continue;
    }

    if (applyQuoteToRowPrice(row, quote)) {
      changed = true;
    }
  }

  return changed;
}

async function refreshMarketData() {
  setCryptoStatus("Market auto-update: syncing CoinGecko + FX API...", false);

  try {
    const results = await Promise.all([refreshCryptoPrices(), refreshUsdCnyRate()]);
    latestCryptoQuotes = results[0];
    cnyPerUsdRate = results[1];
    lastMarketSyncAt = new Date().toLocaleString();

    const changed = applyCryptoQuotesToRows();
    if (changed) {
      savePortfolioData();
    }

    updateTotals();
    saveMarketFeedSnapshot();
    renderMarketDataFooter();

    setCryptoStatus("Market auto-update: synced at " + lastMarketSyncAt, false);
    return true;
  } catch (error) {
    console.error("Failed to refresh market data:", error);
    lastMarketSyncAt = new Date().toLocaleString();
    saveMarketFeedSnapshot();
    renderMarketDataFooter();
    setCryptoStatus("Market auto-update: failed at " + lastMarketSyncAt, true);
    return false;
  }
}

function getRetryDelayMs(failureCount) {
  const backoffMultiplier = Math.pow(2, Math.max(0, failureCount - 1));
  return Math.min(MARKET_RETRY_BASE_MS * backoffMultiplier, MARKET_RETRY_MAX_MS);
}

function clearScheduledMarketRefresh() {
  if (marketRefreshTimerId !== null) {
    window.clearTimeout(marketRefreshTimerId);
    marketRefreshTimerId = null;
  }
}

function scheduleNextMarketRefresh(delayMs) {
  clearScheduledMarketRefresh();
  marketRefreshTimerId = window.setTimeout(runMarketRefreshCycle, Math.max(0, delayMs));
}

async function runMarketRefreshCycle() {
  if (marketRefreshInFlight) {
    scheduleNextMarketRefresh(MIN_MARKET_REQUEST_GAP_MS);
    return;
  }

  const now = Date.now();
  const elapsed = now - lastMarketRequestAt;
  if (elapsed < MIN_MARKET_REQUEST_GAP_MS) {
    scheduleNextMarketRefresh(MIN_MARKET_REQUEST_GAP_MS - elapsed);
    return;
  }

  marketRefreshInFlight = true;
  lastMarketRequestAt = Date.now();
  saveMarketFeedSnapshot();

  const success = await refreshMarketData();
  marketRefreshInFlight = false;

  if (success) {
    marketConsecutiveFailures = 0;
    scheduleNextMarketRefresh(MARKET_REFRESH_INTERVAL_MS);
    return;
  }

  marketConsecutiveFailures += 1;
  const retryDelayMs = getRetryDelayMs(marketConsecutiveFailures);
  const retryMinutes = Math.round(retryDelayMs / 60000);
  setCryptoStatus(
    "Market auto-update: failed at " +
      lastMarketSyncAt +
      " | retry in " +
      retryMinutes +
      " min",
    true
  );
  scheduleNextMarketRefresh(retryDelayMs);
}

function startMarketAutoRefresh() {
  runMarketRefreshCycle();
}

function normalizeCellNumber(cell, type) {
  const value = parseCurrencyNumber(cell.textContent);
  const safeValue = Number.isFinite(value) ? value : 0;

  if (type === "position") {
    cell.textContent = POSITION_FORMATTER.format(safeValue);
    return;
  }

  cell.textContent = VALUE_FORMATTER.format(safeValue);
}

function updateMarketValues() {
  const rows = getDataRows();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const currencySelect = row.querySelector(".currency-select");
    const positionCell = row.querySelector(".postion");
    const priceCell = row.querySelector(".price");
    const usdCell = row.querySelector(".usd");
    const cnyCell = row.querySelector(".cny");

    if (!currencySelect || !positionCell || !priceCell || !usdCell || !cnyCell) {
      continue;
    }

    const position = parseCurrencyNumber(positionCell.textContent);
    const price = parseCurrencyNumber(priceCell.textContent);
    const baseValue = position * price;

    let usdValue = 0;
    let cnyValue = 0;

    if (currencySelect.value === "CNY") {
      cnyValue = baseValue;
      usdValue = cnyValue / cnyPerUsdRate;
    } else {
      usdValue = baseValue;
      cnyValue = usdValue * cnyPerUsdRate;
    }

    usdCell.textContent = formatCurrency(usdValue, "$");
    cnyCell.textContent = formatCurrency(cnyValue, "¥");
  }
}

function normalizeAllEditableFields() {
  const rows = getDataRows();

  for (let i = 0; i < rows.length; i++) {
    const positionCell = rows[i].querySelector(".postion");
    const priceCell = rows[i].querySelector(".price");

    if (positionCell) {
      normalizeCellNumber(positionCell, "position");
    }

    if (priceCell) {
      normalizeCellNumber(priceCell, "price");
    }
  }
}

function migrateCnyRowsPositionPriceSwap() {
  if (localStorage.getItem(CNY_SWAP_MIGRATION_KEY) === "1") {
    return;
  }

  const rows = getDataRows();
  let hasChanges = false;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = getRowId(row);
    const currencySelect = row.querySelector(".currency-select");
    const positionCell = row.querySelector(".postion");
    const priceCell = row.querySelector(".price");

    if (!currencySelect || !positionCell || !priceCell) {
      continue;
    }

    if (currencySelect.value !== "CNY" || CRYPTO_ASSET_IDS[rowId]) {
      continue;
    }

    const position = parseCurrencyNumber(positionCell.textContent);
    const price = parseCurrencyNumber(priceCell.textContent);
    positionCell.textContent = POSITION_FORMATTER.format(price);
    priceCell.textContent = VALUE_FORMATTER.format(position);
    hasChanges = true;
  }

  if (hasChanges) {
    savePortfolioData();
  }

  localStorage.setItem(CNY_SWAP_MIGRATION_KEY, "1");
}

function fillPositionEditorOptions() {
  const select = document.getElementById("positionAssetSelect");
  if (!select) {
    return;
  }

  const rows = getDataRows();
  let html = '<option value="" selected>Select an asset...</option>';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = getRowId(row);
    const nameCell = row.querySelector("td:nth-child(2)");
    if (!rowId || !nameCell) {
      continue;
    }

    const label = rowId + " - " + nameCell.textContent.trim();
    html += '<option value="' + rowId + '">' + label + "</option>";
  }

  select.innerHTML = html;
}

function updateHighlightedAssetRow(selectedAssetId) {
  const rows = getDataRows();

  for (let i = 0; i < rows.length; i++) {
    const rowId = getRowId(rows[i]);
    rows[i].classList.toggle("selected-asset-row", rowId === selectedAssetId);
  }
}

function syncPositionInputWithSelectedAsset() {
  const select = document.getElementById("positionAssetSelect");
  const input = document.getElementById("positionSizeInput");
  const applyBtn = document.getElementById("positionApplyBtn");
  if (!select || !input) {
    return;
  }

  updateHighlightedAssetRow(select.value);

  if (!select.value) {
    input.value = "";
    input.disabled = true;
    if (applyBtn) {
      applyBtn.disabled = true;
    }
    return;
  }

  input.disabled = false;
  if (applyBtn) {
    applyBtn.disabled = false;
  }

  const row = getRowByAssetId(select.value);
  const positionCell = row ? row.querySelector(".postion") : null;
  const position = positionCell ? parseCurrencyNumber(positionCell.textContent) : 0;
  input.value = position.toString();
}

function showPositionEditSuccessFeedback(row) {
  if (!row) {
    return;
  }

  row.classList.remove("position-edit-success");
  void row.offsetWidth;
  row.classList.add("position-edit-success");

  window.setTimeout(function () {
    row.classList.remove("position-edit-success");
  }, 900);
}

function focusPositionSizeInput() {
  const input = document.getElementById("positionSizeInput");
  if (!input || input.disabled) {
    return;
  }

  input.focus();
  input.select();
}

function handleAssetSelectionChange() {
  syncPositionInputWithSelectedAsset();
  focusPositionSizeInput();
}

function applyPositionSizeUpdate(event) {
  event.preventDefault();

  const select = document.getElementById("positionAssetSelect");
  const input = document.getElementById("positionSizeInput");
  if (!select || !input) {
    return;
  }

  const row = getRowByAssetId(select.value);
  if (!row) {
    return;
  }

  const positionCell = row.querySelector(".postion");
  if (!positionCell) {
    return;
  }

  const nextValue = parseCurrencyNumber(input.value);
  const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
  positionCell.textContent = POSITION_FORMATTER.format(safeValue);
  savePortfolioData();
  updateTotals();
  syncPositionInputWithSelectedAsset();
  showPositionEditSuccessFeedback(row);
}

function getAllocationData() {
  const rows = getDataRows();
  const allocation = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nameCell = row.querySelector("td:nth-child(2)");
    const usdCell = row.querySelector(".usd");

    if (!nameCell || !usdCell) {
      continue;
    }

    const value = parseCurrencyNumber(usdCell.textContent);
    if (value <= 0) {
      continue;
    }

    allocation.push({
      label: nameCell.textContent.trim(),
      value,
    });
  }

  return allocation;
}

function drawAllocationPieChart(items) {
  const canvas = document.getElementById("allocationChart");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const size = 320;
  canvas.width = Math.floor(size * pixelRatio);
  canvas.height = Math.floor(size * pixelRatio);
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  ctx.clearRect(0, 0, size, size);

  const total = items.reduce(function (sum, item) {
    return sum + item.value;
  }, 0);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 124;

  if (!total) {
    ctx.fillStyle = "#7c93a8";
    ctx.font = "14px JetBrains Mono, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("No allocation data", centerX, centerY);
    return;
  }

  let startAngle = -Math.PI / 2;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const angle = (item.value / total) * Math.PI * 2;
    const endAngle = startAngle + angle;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = PIE_COLORS[i % PIE_COLORS.length];
    ctx.fill();

    startAngle = endAngle;
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, 62, 0, Math.PI * 2);
  ctx.fillStyle = "#0a1118";
  ctx.fill();

  ctx.fillStyle = "#7c93a8";
  ctx.font = "12px JetBrains Mono, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("TOTAL USD", centerX, centerY - 8);

  ctx.fillStyle = "#22e3a4";
  ctx.font = "bold 14px JetBrains Mono, Menlo, monospace";
  ctx.fillText("$" + total.toFixed(2), centerX, centerY + 10);

  const totalCny = total * cnyPerUsdRate;
  ctx.fillStyle = "#a8ceff";
  ctx.font = "12px JetBrains Mono, Menlo, monospace";
  ctx.fillText("¥" + totalCny.toFixed(2), centerX, centerY + 30);
}

function renderAllocationLegend(items) {
  const legend = document.getElementById("allocationLegend");
  if (!legend) {
    return;
  }

  const total = items.reduce(function (sum, item) {
    return sum + item.value;
  }, 0);

  if (!total || !items.length) {
    legend.innerHTML = '<li class="legend-empty">No positions with market value yet.</li>';
    return;
  }

  let html = "";

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const color = PIE_COLORS[i % PIE_COLORS.length];
    const percent = ((item.value / total) * 100).toFixed(1);

    html +=
      '<li class="legend-item">' +
      '<span class="legend-left">' +
      '<span class="legend-dot" style="background:' + color + '"></span>' +
      '<span class="legend-name">' + item.label + "</span>" +
      "</span>" +
      '<span class="legend-right">' + percent + "%</span>" +
      "</li>";
  }

  legend.innerHTML = html;
}

function updateAllocationChart() {
  const items = getAllocationData().sort(function (a, b) {
    return b.value - a.value;
  });
  drawAllocationPieChart(items);
  renderAllocationLegend(items);
}

function updateTotals() {
  updateMarketValues();

  const usdCells = document.querySelectorAll(".usd");
  const cnyCells = document.querySelectorAll(".cny");

  let usdTotal = 0;
  let cnyTotal = 0;

  for (let i = 0; i < usdCells.length; i++) {
    usdTotal += parseCurrencyNumber(usdCells[i].textContent);
  }

  for (let i = 0; i < cnyCells.length; i++) {
    cnyTotal += parseCurrencyNumber(cnyCells[i].textContent);
  }

  const usdTotalCell = document.getElementById("usdTotal");
  const cnyTotalCell = document.getElementById("cnyTotal");

  if (usdTotalCell) {
    usdTotalCell.textContent = "$" + usdTotal.toFixed(2);
  }

  if (cnyTotalCell) {
    cnyTotalCell.textContent = "¥" + cnyTotal.toFixed(2);
  }

  updateAllocationChart();
}

function savePortfolioData() {
  const rows = getDataRows();
  const data = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = getRowId(row);

    if (!rowId) {
      continue;
    }

    const currencySelect = row.querySelector(".currency-select");
    const positionCell = row.querySelector(".postion");
    const priceCell = row.querySelector(".price");
    const usdCell = row.querySelector(".usd");
    const cnyCell = row.querySelector(".cny");

    data[rowId] = {
      currency: currencySelect ? currencySelect.value : "",
      position: positionCell ? positionCell.textContent.trim() : "",
      price: priceCell ? priceCell.textContent.trim() : "",
      usd: usdCell ? usdCell.textContent.trim() : "",
      cny: cnyCell ? cnyCell.textContent.trim() : "",
    };
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restorePortfolioData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }

  let savedData;
  try {
    savedData = JSON.parse(raw);
  } catch (error) {
    console.error("Saved portfolio data is invalid JSON:", error);
    return;
  }

  const rows = getDataRows();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = getRowId(row);
    const rowData = savedData[rowId];

    if (!rowData) {
      continue;
    }

    const currencySelect = row.querySelector(".currency-select");
    const positionCell = row.querySelector(".postion");
    const priceCell = row.querySelector(".price");
    const usdCell = row.querySelector(".usd");
    const cnyCell = row.querySelector(".cny");

    if (currencySelect && rowData.currency) {
      currencySelect.value = rowData.currency;
    }

    if (positionCell && typeof rowData.position === "string") {
      positionCell.textContent = rowData.position;
    }

    if (priceCell && typeof rowData.price === "string") {
      priceCell.textContent = rowData.price;
    }

    if (usdCell && typeof rowData.usd === "string") {
      usdCell.textContent = rowData.usd;
    }

    if (cnyCell && typeof rowData.cny === "string") {
      cnyCell.textContent = rowData.cny;
    }
  }
}

function bindPersistenceEvents() {
  const currencySelects = document.querySelectorAll(".currency-select");

  for (let i = 0; i < currencySelects.length; i++) {
    currencySelects[i].addEventListener("change", function () {
      const row = currencySelects[i].closest("tr");
      if (row) {
        applyLatestQuoteForRowIfCrypto(row);
      }
      savePortfolioData();
      updateTotals();
    });
  }

  const positionEditorForm = document.getElementById("positionEditorForm");
  const positionAssetSelect = document.getElementById("positionAssetSelect");
  if (positionEditorForm) {
    positionEditorForm.addEventListener("submit", applyPositionSizeUpdate);
  }
  if (positionAssetSelect) {
    positionAssetSelect.addEventListener("change", handleAssetSelectionChange);
  }

  window.addEventListener("resize", updateAllocationChart);
}

restorePortfolioData();
restoreMarketFeedSnapshot();
migrateCnyRowsPositionPriceSwap();
normalizeAllEditableFields();
applyCryptoQuotesToRows();
updateTotals();
renderMarketDataFooter();
fillPositionEditorOptions();
syncPositionInputWithSelectedAsset();
bindPersistenceEvents();
startMarketAutoRefresh();
