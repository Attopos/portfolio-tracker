const MARKET_FEED_STORAGE_KEY = "portfolioMarketFeedV1";
const CNY_SWAP_MIGRATION_KEY = "portfolioCnySwapMigratedV1";
const DEFAULT_CNY_PER_USD = 6.91;
const MARKET_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MIN_MARKET_REQUEST_GAP_MS = 30 * 1000;
const MARKET_RETRY_BASE_MS = 60 * 1000;
const MARKET_RETRY_MAX_MS = 30 * 60 * 1000;
const FX_RATE_API_URL = "https://api.frankfurter.app/latest?from=USD&to=CNY";
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
const INITIAL_PORTFOLIO_ROWS = [];
const GOOGLE_CLIENT_ID =
  "133813157158-6mmjhgrbtdg0okk6dton4c6r786p51m4.apps.googleusercontent.com";
const API_BASE_URL = deriveApiBaseUrl();
const PORTFOLIO_HISTORY_RANGES = ["7d", "30d", "90d", "1y"];
const NEW_TRANSACTION_ASSET_VALUE = "__new__";
let cnyPerUsdRate = DEFAULT_CNY_PER_USD;
let lastMarketSyncAt = "";
let lastMarketRequestAt = 0;
let marketConsecutiveFailures = 0;
let marketRefreshTimerId = null;
let marketRefreshInFlight = false;
let currentLocalUserId = null;
let currentLocalUserProfile = null;
let activePortfolioHistoryRange = "30d";
let portfolioHistoryRequestId = 0;
let currentPortfolioHistoryPoints = [];
let currentTransactions = [];
let positionEditSuccessTimerId = null;

// Small UI helper for Google auth status text.
function setAuthStatus(message, isError) {
  const statusEl = document.getElementById("auth-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9f9f" : "";
}

function setAuthUiState(user) {
  const loggedOutEl = document.getElementById("auth-logged-out");
  const loggedInEl = document.getElementById("auth-logged-in");
  const nameEl = document.getElementById("auth-user-name");
  const emailEl = document.getElementById("auth-user-email");
  const hasUser = Boolean(user && user.id);

  if (loggedOutEl) {
    loggedOutEl.classList.toggle("auth-state-hidden", hasUser);
  }

  if (loggedInEl) {
    loggedInEl.classList.toggle("auth-state-hidden", !hasUser);
  }

  if (nameEl) {
    nameEl.textContent = hasUser
      ? String(user.name || user.email || "Google user").trim() || "Google user"
      : "Google user";
  }

  if (emailEl) {
    emailEl.textContent = hasUser ? String(user.email || "").trim() : "";
  }
}

function clearAuthenticatedPortfolioView() {
  replacePortfolioRows([]);
  currentPortfolioHistoryPoints = [];
  currentTransactions = [];
  renderTransactionsTable([]);
  setPortfolioHistoryState("Sign in to load portfolio history.", { showState: true });
}

// GIS callback: log token, send it to backend, and show verification status.
async function handleCredentialResponse(response) {
  console.log("Google sign-in response:", response);
  console.log("Google ID token:", response.credential);

  const credential = String(response && response.credential ? response.credential : "").trim();
  if (!credential) {
    setAuthStatus("Google sign-in failed: missing credential.", true);
    return;
  }

  try {
    const res = await fetch(
      getApiUrl("/auth/google"),
      buildFetchOptions({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential }),
      })
    );

    const data = await res.json();
    console.log("Backend auth response:", data);

    if (!res.ok || !data || data.ok !== true) {
      const message = data && data.error ? data.error : "Google token verification failed.";
      currentLocalUserId = null;
      setAuthStatus(message, true);
      return;
    }

    const localUserId = Number(data && data.user && data.user.id);
    if (!Number.isInteger(localUserId) || localUserId <= 0) {
      currentLocalUserId = null;
      currentLocalUserProfile = null;
      setAuthUiState(null);
      setAuthStatus("Backend auth response missing a valid local user id.", true);
      return;
    }

    currentLocalUserId = localUserId;
    currentLocalUserProfile = data.user;
    setAuthUiState(currentLocalUserProfile);
    console.log("Current local user id:", currentLocalUserId);

    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();
    setAuthStatus("Google token verified by backend.", false);
  } catch (error) {
    console.error("Google auth request failed:", error);
    currentLocalUserId = null;
    currentLocalUserProfile = null;
    setAuthUiState(null);
    setAuthStatus("Google auth request failed.", true);
  }
}

// Initialize and render the Google Sign-In button.
function initGoogleSignIn() {
  const signInContainer = document.getElementById("google-signin-btn");
  const signUpContainer = document.getElementById("google-signup-btn");
  if (!signInContainer || !signUpContainer) {
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse,
  });

  google.accounts.id.renderButton(signInContainer, {
    type: "standard",
    theme: "outline",
    size: "medium",
    text: "signin_with",
    shape: "rectangular",
  });

  google.accounts.id.renderButton(signUpContainer, {
    type: "standard",
    theme: "filled_black",
    size: "medium",
    text: "signup_with",
    shape: "rectangular",
  });

  setAuthStatus("Google sign-in button ready.", false);
}

// Wait for GIS script to be available before initializing.
function initGoogleSignInWhenReady(attempt) {
  const nextAttempt = Number.isFinite(attempt) ? attempt : 0;
  if (window.google && window.google.accounts && window.google.accounts.id) {
    initGoogleSignIn();
    return;
  }

  if (nextAttempt >= 40) {
    setAuthStatus("Google GIS failed to load.", true);
    return;
  }

  window.setTimeout(function () {
    initGoogleSignInWhenReady(nextAttempt + 1);
  }, 150);
}

function deriveApiBaseUrl() {
  const override = String(window.__API_BASE_URL || "").trim();
  if (override) {
    return override.replace(/\/+$/, "");
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const port = window.location.port;

  if (protocol === "file:") {
    return "http://localhost:3000";
  }

  if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "3000") {
    return protocol + "//" + hostname + ":3000";
  }

  return "";
}

function buildFetchOptions(options) {
  const nextOptions = options && typeof options === "object" ? { ...options } : {};
  nextOptions.credentials = "include";
  return nextOptions;
}

function setActiveActionTab(nextTab) {
  const targetTab = String(nextTab || "").trim() || "edit";
  const tabButtons = document.querySelectorAll("[data-action-tab]");
  const panels = document.querySelectorAll("[data-action-panel]");

  for (let i = 0; i < tabButtons.length; i++) {
    const button = tabButtons[i];
    const isActive = button.getAttribute("data-action-tab") === targetTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  }

  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const isActive = panel.getAttribute("data-action-panel") === targetTab;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  }
}

function setActivePortfolioHistoryRange(nextRange) {
  const targetRange = PORTFOLIO_HISTORY_RANGES.includes(nextRange) ? nextRange : "30d";
  activePortfolioHistoryRange = targetRange;

  const tabs = document.querySelectorAll("[data-history-range]");
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const isActive = tab.getAttribute("data-history-range") === targetRange;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", isActive ? "true" : "false");
  }
}

function setPortfolioHistoryState(message, options) {
  const stateEl = document.getElementById("portfolioHistoryState");
  const canvas = document.getElementById("portfolioHistoryChart");
  const nextOptions = options && typeof options === "object" ? options : {};
  const showState = Boolean(nextOptions.showState);
  const isError = Boolean(nextOptions.isError);

  if (stateEl) {
    stateEl.textContent = message || "";
    stateEl.classList.toggle("is-hidden", !showState);
    stateEl.classList.toggle("error", isError);
  }

  if (canvas) {
    canvas.classList.toggle("is-hidden", showState);
  }
}

function formatCompactUsd(value) {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return "$" + (value / 1000000).toFixed(1) + "M";
  }
  if (absValue >= 1000) {
    return "$" + (value / 1000).toFixed(1) + "K";
  }
  return "$" + value.toFixed(0);
}

function formatHistoryAxisUsd(value, span, precisionBoost) {
  const absValue = Math.abs(value);
  const safeSpan = Math.abs(Number(span)) || 0;
  const extraPrecision = Math.max(0, Number(precisionBoost) || 0);

  if (absValue >= 1000000) {
    const decimals = (safeSpan >= 100000 ? 1 : safeSpan >= 10000 ? 2 : safeSpan >= 1000 ? 3 : 4) + extraPrecision;
    return "$" + (value / 1000000).toFixed(decimals) + "M";
  }

  if (absValue >= 1000) {
    const decimals = (safeSpan >= 10000 ? 1 : safeSpan >= 1000 ? 2 : safeSpan >= 100 ? 3 : 4) + extraPrecision;
    return "$" + (value / 1000).toFixed(decimals) + "K";
  }

  const decimals = (safeSpan >= 10 ? 0 : safeSpan >= 1 ? 1 : 2) + extraPrecision;
  return "$" + value.toFixed(decimals);
}

function normalizeHistoryValues(values) {
  const numericValues = Array.isArray(values)
    ? values.map(function (value) {
        return Number(value) || 0;
      })
    : [];

  if (numericValues.length === 0) {
    return {
      values: [],
      minValue: 0,
      maxValue: 0,
      displayMinValue: 0,
      displayMaxValue: 1,
      displaySpan: 1,
      isEffectivelyFlat: true,
    };
  }

  const minValue = Math.min.apply(null, numericValues);
  const maxValue = Math.max.apply(null, numericValues);
  const valueRange = maxValue - minValue;
  const referenceValue = Math.max(Math.abs(minValue), Math.abs(maxValue), 1);
  const flattenTolerance = Math.max(0.01, referenceValue * 0.00001);
  const isEffectivelyFlat = valueRange <= flattenTolerance;

  if (isEffectivelyFlat) {
    const averageValue =
      numericValues.reduce(function (sum, value) {
        return sum + value;
      }, 0) / numericValues.length;
    const padding = Math.max(flattenTolerance * 4, Math.abs(averageValue) * 0.01, 1);

    return {
      values: numericValues.map(function () {
        return averageValue;
      }),
      minValue,
      maxValue,
      displayMinValue: averageValue - padding,
      displayMaxValue: averageValue + padding,
      displaySpan: padding * 2,
      isEffectivelyFlat: true,
    };
  }

  return {
    values: numericValues,
    minValue,
    maxValue,
    displayMinValue: minValue,
    displayMaxValue: maxValue,
    displaySpan: valueRange,
    isEffectivelyFlat: false,
  };
}

function getHistoryDateKey(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return (
    String(date.getFullYear()) +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function preparePortfolioHistoryPoints(points, range) {
  const normalizedPoints = Array.isArray(points)
    ? points
        .filter(function (point) {
          return point && !Number.isNaN(new Date(point.capturedAt).getTime());
        })
        .slice()
        .sort(function (left, right) {
          return new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime();
        })
    : [];

  if (normalizedPoints.length <= 1) {
    return normalizedPoints;
  }

  const firstPointAt = new Date(normalizedPoints[0].capturedAt).getTime();
  const lastPointAt = new Date(normalizedPoints[normalizedPoints.length - 1].capturedAt).getTime();
  if (lastPointAt - firstPointAt < 24 * 60 * 60 * 1000) {
    return [normalizedPoints[normalizedPoints.length - 1]];
  }

  if (range === "7d") {
    return normalizedPoints;
  }

  const lastPointByDay = new Map();
  for (let i = 0; i < normalizedPoints.length; i++) {
    const point = normalizedPoints[i];
    const dateKey = getHistoryDateKey(point.capturedAt);
    if (!dateKey) {
      continue;
    }
    lastPointByDay.set(dateKey, point);
  }

  return Array.from(lastPointByDay.values()).sort(function (left, right) {
    return new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime();
  });
}

function getNiceHistoryStep(roughStep) {
  const safeStep = Math.abs(Number(roughStep)) || 1;
  const exponent = Math.floor(Math.log10(safeStep));
  const fraction = safeStep / Math.pow(10, exponent);
  let niceFraction = 1;

  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  return niceFraction * Math.pow(10, exponent);
}

function buildHistoryAxisTicks(minValue, maxValue, tickCount) {
  const safeTickCount = Math.max(2, Number(tickCount) || 4);
  const safeMinValue = Number(minValue) || 0;
  const safeMaxValue = Number(maxValue) || 0;
  const span = Math.max(safeMaxValue - safeMinValue, 1e-9);
  const step = getNiceHistoryStep(span / (safeTickCount - 1));
  let axisMin = Math.floor(safeMinValue / step) * step;
  let axisMax = axisMin + step * (safeTickCount - 1);

  if (axisMax < safeMaxValue) {
    axisMax = Math.ceil(safeMaxValue / step) * step;
    axisMin = axisMax - step * (safeTickCount - 1);
  }

  const ticks = [];
  for (let i = 0; i < safeTickCount; i++) {
    ticks.push(axisMin + step * i);
  }

  return {
    minValue: axisMin,
    maxValue: axisMax,
    step,
    ticks,
  };
}

function buildHistoryAxisTickLabels(ticks, span) {
  for (let precisionBoost = 0; precisionBoost <= 6; precisionBoost++) {
    const labels = ticks.map(function (tick) {
      return formatHistoryAxisUsd(tick, span, precisionBoost);
    });
    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }

  return ticks.map(function (tick) {
    return "$" + tick.toFixed(2);
  });
}

function formatHistoryPointDate(dateString, range) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (range === "7d") {
    return (
      String(date.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(date.getDate()).padStart(2, "0") +
      " " +
      String(date.getHours()).padStart(2, "0") +
      ":00"
    );
  }

  return (
    String(date.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(date.getDate()).padStart(2, "0")
  );
}

function drawPortfolioHistoryChart(points, range) {
  const canvas = document.getElementById("portfolioHistoryChart");
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.clientWidth || 1080;
  const height = 320;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.height = height + "px";
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const chartPadding = { top: 22, right: 24, bottom: 42, left: 72 };
  const chartWidth = width - chartPadding.left - chartPadding.right;
  const chartHeight = height - chartPadding.top - chartPadding.bottom;

  const values = points.map(function (point) {
    return Number(point.totalUsd) || 0;
  });
  const normalizedValues = normalizeHistoryValues(values);
  const axis = buildHistoryAxisTicks(normalizedValues.displayMinValue, normalizedValues.displayMaxValue, 4);
  const axisLabels = buildHistoryAxisTickLabels(axis.ticks, axis.maxValue - axis.minValue);
  const safeMinValue = axis.minValue;
  const safeMaxValue = axis.maxValue;
  const safeValueSpan = safeMaxValue - safeMinValue || 1;

  ctx.strokeStyle = "rgba(139, 195, 255, 0.12)";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#7c93a8";
  ctx.font = '12px "JetBrains Mono", Menlo, monospace';
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i < axis.ticks.length; i++) {
    const ratio = i / (axis.ticks.length - 1 || 1);
    const y = chartPadding.top + chartHeight * ratio;
    const labelIndex = axis.ticks.length - 1 - i;
    ctx.beginPath();
    ctx.moveTo(chartPadding.left, y);
    ctx.lineTo(chartPadding.left + chartWidth, y);
    ctx.stroke();
    ctx.fillText(axisLabels[labelIndex], chartPadding.left - 10, y);
  }

  ctx.strokeStyle = "rgba(139, 195, 255, 0.18)";
  ctx.beginPath();
  ctx.moveTo(chartPadding.left, chartPadding.top + chartHeight);
  ctx.lineTo(chartPadding.left + chartWidth, chartPadding.top + chartHeight);
  ctx.stroke();

  const plottedPoints = [];
  for (let i = 0; i < points.length; i++) {
    const xRatio = points.length === 1 ? 0.5 : i / (points.length - 1);
    const yRatio = (normalizedValues.values[i] - safeMinValue) / safeValueSpan;
    plottedPoints.push({
      x: chartPadding.left + chartWidth * xRatio,
      y: chartPadding.top + chartHeight - chartHeight * yRatio,
    });
  }

  ctx.beginPath();
  for (let i = 0; i < plottedPoints.length; i++) {
    const point = plottedPoints[i];
    if (i === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  }

  ctx.strokeStyle = "#22e3a4";
  ctx.lineWidth = 2.4;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(plottedPoints[0].x, chartPadding.top + chartHeight);
  for (let i = 0; i < plottedPoints.length; i++) {
    ctx.lineTo(plottedPoints[i].x, plottedPoints[i].y);
  }
  ctx.lineTo(plottedPoints[plottedPoints.length - 1].x, chartPadding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = "rgba(34, 227, 164, 0.12)";
  ctx.fill();

  for (let i = 0; i < plottedPoints.length; i++) {
    const point = plottedPoints[i];
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = "#22e3a4";
    ctx.fill();
    ctx.strokeStyle = "#08131d";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const labelIndexes = points.length < 3 ? [0, points.length - 1] : [0, Math.floor(points.length / 2), points.length - 1];
  const seenIndexes = new Set();
  ctx.fillStyle = "#7c93a8";
  ctx.font = '12px "JetBrains Mono", Menlo, monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  for (let i = 0; i < labelIndexes.length; i++) {
    const pointIndex = labelIndexes[i];
    if (pointIndex < 0 || pointIndex >= points.length || seenIndexes.has(pointIndex)) {
      continue;
    }
    seenIndexes.add(pointIndex);
    ctx.fillText(
      formatHistoryPointDate(points[pointIndex].capturedAt, range),
      plottedPoints[pointIndex].x,
      chartPadding.top + chartHeight + 12
    );
  }
}

async function fetchPortfolioHistoryFromServer(range) {
  const res = await fetch(
    getApiUrl("/api/portfolio-history?range=" + encodeURIComponent(range)),
    buildFetchOptions()
  );

  if (!res.ok) {
    let message = "Failed to load portfolio history";
    try {
      const payload = await res.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch (error) {
      // keep default message
    }
    throw new Error(message);
  }

  const payload = await res.json();
  return Array.isArray(payload && payload.points) ? payload.points : [];
}

async function refreshPortfolioHistory(range) {
  const nextRange = PORTFOLIO_HISTORY_RANGES.includes(range) ? range : activePortfolioHistoryRange;
  const requestId = portfolioHistoryRequestId + 1;
  portfolioHistoryRequestId = requestId;
  setActivePortfolioHistoryRange(nextRange);

  if (!currentLocalUserId) {
    setPortfolioHistoryState("Sign in to load portfolio history.", { showState: true });
    return;
  }

  setPortfolioHistoryState("Loading portfolio history...", { showState: true });

  try {
    const points = preparePortfolioHistoryPoints(await fetchPortfolioHistoryFromServer(nextRange), nextRange);
    if (requestId !== portfolioHistoryRequestId) {
      return;
    }

    if (!Array.isArray(points) || points.length === 0) {
      currentPortfolioHistoryPoints = [];
      setPortfolioHistoryState("No historical snapshots yet. Your history will appear as you use the portfolio.", {
        showState: true,
      });
      return;
    }

    currentPortfolioHistoryPoints = points;
    setPortfolioHistoryState("", { showState: false });
    drawPortfolioHistoryChart(points, nextRange);
  } catch (error) {
    if (requestId !== portfolioHistoryRequestId) {
      return;
    }
    currentPortfolioHistoryPoints = [];
    console.error("Failed to refresh portfolio history:", error);
    setPortfolioHistoryState(
      "Failed to load portfolio history. Please try again in a moment.",
      { showState: true, isError: true }
    );
  }
}

async function signOutFromSession() {
  const signOutButton = document.getElementById("signout-btn");
  const previousLabel = signOutButton ? signOutButton.textContent : "";

  if (signOutButton) {
    signOutButton.disabled = true;
    signOutButton.textContent = "Signing out...";
  }

  try {
    const res = await fetch(
      getApiUrl("/auth/logout"),
      buildFetchOptions({
        method: "POST",
      })
    );

    if (!res.ok) {
      let message = "Failed to sign out";
      try {
        const payload = await res.json();
        if (payload && typeof payload.error === "string" && payload.error.trim()) {
          message = payload.error.trim();
        }
      } catch (error) {
        // keep default message
      }
      throw new Error(message);
    }

    currentLocalUserId = null;
    currentLocalUserProfile = null;
    setAuthUiState(null);
    clearAuthenticatedPortfolioView();
    setAuthStatus("Google auth: signed out.", false);

    if (window.google && window.google.accounts && window.google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  } catch (error) {
    console.error("Failed to sign out:", error);
    setAuthStatus("Failed to sign out.", true);
  } finally {
    if (signOutButton) {
      signOutButton.disabled = false;
      signOutButton.textContent = previousLabel || "Sign out";
    }
  }
}

function parseCurrencyNumber(text) {
  const cleaned = (text || "").replace(/[^\d.-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizePortfolioRow(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const id = typeof item.id === "string" ? item.id.trim() : "";
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!id || !name) {
    return null;
  }

  const currency = item.currency === "CNY" ? "CNY" : "USD";
  const position = Number(item.position);
  const price = Number(item.price);

  return {
    id,
    name,
    currency,
    position: Number.isFinite(position) ? position : 0,
    price: Number.isFinite(price) ? price : 0,
  };
}

function buildCurrencySelectOptionsHtml(selectedCurrency) {
  const cnySelected = selectedCurrency === "CNY" ? " selected" : "";
  const usdSelected = selectedCurrency === "USD" ? " selected" : "";
  return (
    '<option value="CNY"' +
    cnySelected +
    ">CNY</option>" +
    '<option value="USD"' +
    usdSelected +
    ">USD</option>"
  );
}

function buildPortfolioRowHtml(item) {
  return (
    '<tr data-asset-id="' +
    escapeHtml(item.id) +
    '">' +
    "<td>" +
    escapeHtml(item.name) +
    "</td>" +
    '<td><select class="currency-select">' +
    buildCurrencySelectOptionsHtml(item.currency) +
    "</select></td>" +
    '<td class="position">' +
    POSITION_FORMATTER.format(item.position) +
    "</td>" +
    '<td class="price">' +
    VALUE_FORMATTER.format(item.price) +
    "</td>" +
    '<td class="usd">$0.00</td>' +
    '<td class="cny">¥0.00</td>' +
    "</tr>"
  );
}

function renderPortfolioRows(items) {
  const tableBody = document.getElementById("portfolioTableBody");
  if (!tableBody) {
    return;
  }

  if (!Array.isArray(items) || !items.length) {
    tableBody.innerHTML = "";
    return;
  }

  let html = "";

  for (let i = 0; i < items.length; i++) {
    const normalized = normalizePortfolioRow(items[i]);
    if (!normalized) {
      continue;
    }

    html += buildPortfolioRowHtml(normalized);
  }

  tableBody.innerHTML = html;
}

function replacePortfolioRows(items) {
  renderPortfolioRows(items);
  normalizeAllEditableFields();
  updateTotals();
  fillPositionEditorOptions();
  fillTransactionAssetOptions();
  fillDeleteAssetOptions();
  syncPositionInputWithSelectedAsset();
  refreshPortfolioHistory(activePortfolioHistoryRange);
}

function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return API_BASE_URL + normalizedPath;
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
  const assetId = row.getAttribute("data-asset-id");
  return assetId ? assetId.trim() : "";
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

function getRowAssetName(row) {
  const cell = row && row.cells ? row.cells[0] : null;
  return cell ? String(cell.textContent || "").trim() : "";
}

function formatTransactionDate(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  return parsed.toLocaleString();
}

function renderTransactionsTable(items) {
  const tableBody = document.getElementById("transactionsTableBody");
  if (!tableBody) {
    return;
  }

  if (!Array.isArray(items) || items.length === 0) {
    tableBody.innerHTML =
      '<tr class="transactions-empty"><td colspan="6">No transactions recorded yet.</td></tr>';
    return;
  }

  let html = "";
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const unitPriceText =
      item && Number.isFinite(Number(item.unitPrice))
        ? VALUE_FORMATTER.format(Number(item.unitPrice))
        : "--";
    html +=
      "<tr>" +
      "<td>" +
      escapeHtml(formatTransactionDate(item.transactedAt)) +
      "</td>" +
      "<td>" +
      escapeHtml(String(item.type || "")) +
      "</td>" +
      "<td>" +
      escapeHtml(String(item.assetName || item.assetId || "")) +
      "</td>" +
      "<td>" +
      POSITION_FORMATTER.format(Number(item.quantity) || 0) +
      "</td>" +
      "<td>" +
      unitPriceText +
      "</td>" +
      "<td>" +
      POSITION_FORMATTER.format(Number(item.positionAfter) || 0) +
      "</td>" +
      "</tr>";
  }

  tableBody.innerHTML = html;
}

function fillTransactionAssetOptions(preferredValue) {
  const select = document.getElementById("transactionAssetSelect");
  if (!select) {
    return;
  }

  const previousValue =
    typeof preferredValue === "string" && preferredValue.trim()
      ? preferredValue.trim()
      : String(select.value || "").trim();
  const rows = getDataRows();
  let optionsHtml = '<option value="' + NEW_TRANSACTION_ASSET_VALUE + '">New asset...</option>';

  for (let i = 0; i < rows.length; i++) {
    const assetId = getRowId(rows[i]);
    const assetName = getRowAssetName(rows[i]);
    if (!assetId) {
      continue;
    }
    optionsHtml +=
      '<option value="' +
      escapeHtml(assetId) +
      '">' +
      escapeHtml(assetName ? assetName + " (" + assetId + ")" : assetId) +
      "</option>";
  }

  select.innerHTML = optionsHtml;
  let hasPreviousValue = false;
  for (let i = 0; i < select.options.length; i++) {
    if (select.options[i].value === previousValue) {
      hasPreviousValue = true;
      break;
    }
  }
  const nextValue = hasPreviousValue ? previousValue : NEW_TRANSACTION_ASSET_VALUE;
  select.value = nextValue;
  toggleTransactionNewAssetFields();
}

function toggleTransactionNewAssetFields() {
  const select = document.getElementById("transactionAssetSelect");
  const fields = document.getElementById("transactionNewAssetFields");
  const assetNameInput = document.getElementById("transactionAssetNameInput");
  const currencySelect = document.getElementById("transactionCurrencySelect");
  if (!select || !fields || !assetNameInput || !currencySelect) {
    return;
  }

  const isNewAsset = select.value === NEW_TRANSACTION_ASSET_VALUE;
  fields.classList.toggle("is-hidden", !isNewAsset);
  assetNameInput.required = isNewAsset;
  currencySelect.required = isNewAsset;
}

function setDefaultTransactionDateInput() {
  const input = document.getElementById("transactionDateInput");
  if (!input) {
    return;
  }

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  input.value = now.toISOString().slice(0, 16);
}

function formatCurrency(value, symbol) {
  return symbol + VALUE_FORMATTER.format(value);
}

function getCurrentUserIdOrThrow() {
  const userId = Number(currentLocalUserId);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Please sign in with Google first.");
  }
  return userId;
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

function renderMarketDataFooter() {
  const footerEl = document.getElementById("marketDataFooter");
  if (!footerEl) {
    return;
  }

  footerEl.textContent =
    "FX USD/CNY: " +
    formatRate(cnyPerUsdRate) +
    " | Updated: " +
    (lastMarketSyncAt || "--");
}

function saveMarketFeedSnapshot() {
  const snapshot = {
    cnyPerUsdRate,
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

async function refreshMarketData() {
  setCryptoStatus("FX auto-update: syncing exchange rate...", false);

  try {
    cnyPerUsdRate = await refreshUsdCnyRate();
    lastMarketSyncAt = new Date().toLocaleString();

    updateTotals();
    saveMarketFeedSnapshot();
    renderMarketDataFooter();

    setCryptoStatus("FX auto-update: synced at " + lastMarketSyncAt, false);
    return true;
  } catch (error) {
    console.error("Failed to refresh FX data:", error);
    lastMarketSyncAt = new Date().toLocaleString();
    saveMarketFeedSnapshot();
    renderMarketDataFooter();
    setCryptoStatus("FX auto-update: failed at " + lastMarketSyncAt, true);
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
    "FX auto-update: failed at " +
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
    const positionCell = row.querySelector(".position");
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
    const positionCell = rows[i].querySelector(".position");
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
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const currencySelect = row.querySelector(".currency-select");
    const positionCell = row.querySelector(".position");
    const priceCell = row.querySelector(".price");

    if (!currencySelect || !positionCell || !priceCell) {
      continue;
    }

    if (currencySelect.value !== "CNY") {
      continue;
    }

    const position = parseCurrencyNumber(positionCell.textContent);
    const price = parseCurrencyNumber(priceCell.textContent);
    positionCell.textContent = POSITION_FORMATTER.format(price);
    priceCell.textContent = VALUE_FORMATTER.format(position);
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
    const displayNameCell = row.querySelector("td:nth-child(1)");
    if (!rowId || !displayNameCell) {
      continue;
    }

    const label = displayNameCell.textContent.trim();
    html += '<option value="' + rowId + '">' + label + "</option>";
  }

  select.innerHTML = html;
}

function fillDeleteAssetOptions() {
  const select = document.getElementById("deleteAssetSelect");
  const submitBtn = document.getElementById("deleteAssetSubmitBtn");
  if (!select) {
    return;
  }

  const currentValue = select.value;
  const rows = getDataRows();
  if (!rows.length) {
    select.innerHTML = '<option value="" selected>No assets available</option>';
    select.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
    }
    return;
  }

  let html = "";
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowId = getRowId(row);
    const displayNameCell = row.querySelector("td:nth-child(1)");
    if (!rowId || !displayNameCell) {
      continue;
    }

    const label = displayNameCell.textContent.trim();
    html += '<option value="' + rowId + '">' + label + "</option>";
  }

  select.innerHTML = html;
  if (currentValue) {
    select.value = currentValue;
  }
  if (!select.value && select.options.length > 0) {
    select.selectedIndex = 0;
  }

  select.disabled = false;
  if (submitBtn) {
    submitBtn.disabled = !select.value;
  }
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
  const positionCell = row ? row.querySelector(".position") : null;
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

function setPositionEditVisualState(state) {
  const panel = document.getElementById("action-panel-edit");
  const signal = document.getElementById("positionEditSignal");
  const applyBtn = document.getElementById("positionApplyBtn");
  const nextState = String(state || "idle").trim();
  const isSaving = nextState === "saving";
  const isSaved = nextState === "saved";

  if (panel) {
    panel.classList.toggle("is-saving", isSaving);
    panel.classList.toggle("is-saved", isSaved);
  }

  if (signal) {
    signal.classList.toggle("is-saving", isSaving);
    signal.classList.toggle("is-saved", isSaved);
  }

  if (applyBtn) {
    applyBtn.classList.toggle("is-saving", isSaving);
    applyBtn.classList.toggle("is-saved", isSaved);
  }
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

async function applyPositionSizeUpdate(event) {
  event.preventDefault();

  const select = document.getElementById("positionAssetSelect");
  const input = document.getElementById("positionSizeInput");
  const applyBtn = document.getElementById("positionApplyBtn");
  if (!select || !input) {
    return;
  }

  if (!select.value) {
    return;
  }

  const row = getRowByAssetId(select.value);
  if (!row) {
    return;
  }

  const positionCell = row.querySelector(".position");
  if (!positionCell) {
    return;
  }

  const nextValue = parseCurrencyNumber(input.value);
  const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
  const applyBtnLabel = applyBtn ? applyBtn.querySelector("span") : null;
  const previousButtonText = applyBtnLabel ? applyBtnLabel.textContent : "";

  if (applyBtn) {
    applyBtn.disabled = true;
  }
  if (applyBtnLabel) {
    applyBtnLabel.textContent = "Saving...";
  }
  setPositionEditVisualState("saving");
  select.disabled = true;
  input.disabled = true;

  try {
    const updated = await updatePositionOnServer(select.value, safeValue);
    const updatedPosition = Number(updated && updated.position);
    const appliedValue = Number.isFinite(updatedPosition) ? updatedPosition : safeValue;

    positionCell.textContent = POSITION_FORMATTER.format(appliedValue);
    updateTotals();
    syncPositionInputWithSelectedAsset();
    showPositionEditSuccessFeedback(row);
    setPositionEditVisualState("saved");
    if (positionEditSuccessTimerId !== null) {
      window.clearTimeout(positionEditSuccessTimerId);
    }
    positionEditSuccessTimerId = window.setTimeout(function () {
      setPositionEditVisualState("idle");
      positionEditSuccessTimerId = null;
    }, 1400);
  } catch (error) {
    console.error("Failed to update position:", error);
    setPositionEditVisualState("idle");
    const message =
      error && typeof error.message === "string" && error.message
        ? error.message
        : "Unknown error";
    window.alert("Failed to update position size: " + message);
  } finally {
    select.disabled = false;
    syncPositionInputWithSelectedAsset();
    if (applyBtnLabel) {
      applyBtnLabel.textContent = previousButtonText || "Apply";
    }
    if (applyBtn) {
      applyBtn.disabled = false;
    }
  }
}

function getAllocationData() {
  const rows = getDataRows();
  const allocation = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const nameCell = row.querySelector("td:nth-child(1)");
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
  const holdingsCount = getDataRows().length;

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

  const summaryUsdEl = document.getElementById("summaryUsdTotal");
  const summaryCnyEl = document.getElementById("summaryCnyTotal");
  const summaryHoldingsEl = document.getElementById("summaryHoldingsCount");

  if (summaryUsdEl) {
    summaryUsdEl.textContent = "$" + usdTotal.toFixed(2);
  }

  if (summaryCnyEl) {
    summaryCnyEl.textContent = "¥" + cnyTotal.toFixed(2);
  }

  if (summaryHoldingsEl) {
    summaryHoldingsEl.textContent = String(holdingsCount);
  }

  updateAllocationChart();
}

async function fetchPositionsFromServer() {
  getCurrentUserIdOrThrow();
  const res = await fetch(getApiUrl("/api/positions"), buildFetchOptions());
  if (!res.ok) {
    let message = "Failed to fetch positions";
    try {
      const payload = await res.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch (error) {
      // keep default message
    }
    throw new Error(message);
  }
  return await res.json();
}

async function updatePositionOnServer(assetId, position) {
  getCurrentUserIdOrThrow();
  const res = await fetch(
    getApiUrl("/api/positions/" + encodeURIComponent(assetId)),
    buildFetchOptions({
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ position }),
    })
  );

  if (!res.ok) {
    let message = "Failed to update position";
    try {
      const payload = await res.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch (error) {
      // keep default message
    }
    throw new Error(message);
  }

  return await res.json();
}

async function createPositionOnServer(payload) {
  getCurrentUserIdOrThrow();
  const res = await fetch(
    getApiUrl("/api/positions"),
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: payload.name,
        currency: payload.currency,
        position: payload.position,
        price: payload.price,
      }),
    })
  );

  if (!res.ok) {
    let message = "Failed to create asset";
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        message = body.error.trim();
      }
    } catch (error) {
      // Keep default message.
    }

    throw new Error(message);
  }

  return await res.json();
}

async function deletePositionOnServer(assetId) {
  getCurrentUserIdOrThrow();
  const deleteUrl = getApiUrl("/api/positions/" + encodeURIComponent(assetId));
  const res = await fetch(
    deleteUrl,
    buildFetchOptions({
      method: "DELETE",
    })
  );

  if (!res.ok) {
    let message = "Failed to delete asset";
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        message = body.error.trim();
      }
    } catch (error) {
      // Keep default message.
    }

    throw new Error(message);
  }

  return await res.json();
}

async function fetchTransactionsFromServer() {
  getCurrentUserIdOrThrow();
  const res = await fetch(getApiUrl("/api/transactions"), buildFetchOptions());
  if (!res.ok) {
    let message = "Failed to fetch transactions";
    try {
      const payload = await res.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch (error) {
      // keep default message
    }
    throw new Error(message);
  }

  const payload = await res.json();
  return Array.isArray(payload && payload.transactions) ? payload.transactions : [];
}

async function createTransactionOnServer(payload) {
  getCurrentUserIdOrThrow();
  const res = await fetch(
    getApiUrl("/api/transactions"),
    buildFetchOptions({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
  );

  if (!res.ok) {
    let message = "Failed to record transaction";
    try {
      const body = await res.json();
      if (body && typeof body.error === "string" && body.error.trim()) {
        message = body.error.trim();
      }
    } catch (error) {
      // Keep default message.
    }

    throw new Error(message);
  }

  const body = await res.json();
  return body && body.transaction ? body.transaction : null;
}

async function refreshTransactions() {
  if (!currentLocalUserId) {
    currentTransactions = [];
    renderTransactionsTable([]);
    return;
  }

  try {
    currentTransactions = await fetchTransactionsFromServer();
    renderTransactionsTable(currentTransactions);
  } catch (error) {
    console.error("Failed to refresh transactions:", error);
    renderTransactionsTable([]);
  }
}

async function fetchCurrentLocalUserFromSession() {
  const res = await fetch(getApiUrl("/api/me"), buildFetchOptions());
  if (res.status === 401) {
    return null;
  }

  if (!res.ok) {
    let message = "Failed to restore session";
    try {
      const payload = await res.json();
      if (payload && typeof payload.error === "string" && payload.error.trim()) {
        message = payload.error.trim();
      }
    } catch (error) {
      // keep default message
    }
    throw new Error(message);
  }

  const payload = await res.json();
  const user = payload && payload.user ? payload.user : null;
  const userId = Number(user && user.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("Session response missing a valid local user id.");
  }

  return user;
}

async function restoreAuthSession() {
  try {
    const user = await fetchCurrentLocalUserFromSession();
    if (!user) {
      currentLocalUserId = null;
      currentLocalUserProfile = null;
      setAuthUiState(null);
      setAuthStatus("Google auth: not signed in.", false);
      return;
    }

    currentLocalUserId = Number(user.id);
    currentLocalUserProfile = user;
    setAuthUiState(user);
    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();
    setAuthStatus("Session restored from backend.", false);
  } catch (error) {
    console.error("Failed to restore auth session:", error);
    currentLocalUserId = null;
    currentLocalUserProfile = null;
    setAuthUiState(null);
    setAuthStatus("Failed to restore backend session.", true);
  }
}

async function applyCreateAsset(event) {
  event.preventDefault();

  const form = document.getElementById("createAssetForm");
  const nameInput = document.getElementById("createAssetNameInput");
  const currencySelect = document.getElementById("createAssetCurrencySelect");
  const positionInput = document.getElementById("createAssetPositionInput");
  const priceInput = document.getElementById("createAssetPriceInput");
  const submitBtn = document.getElementById("createAssetSubmitBtn");

  if (
    !form ||
    !nameInput ||
    !currencySelect ||
    !positionInput ||
    !priceInput ||
    !submitBtn
  ) {
    return;
  }

  const name = nameInput.value.trim();
  const currency = currencySelect.value === "CNY" ? "CNY" : "USD";
  const position = parseCurrencyNumber(positionInput.value);
  const price = parseCurrencyNumber(priceInput.value);

  if (!name) {
    window.alert("Name is required.");
    return;
  }

  const previousBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating...";

  try {
    await createPositionOnServer({
      name,
      currency,
      position,
      price,
    });

    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    form.reset();
    currencySelect.value = "USD";
  } catch (error) {
    console.error("Failed to create asset:", error);
    let message =
      error && typeof error.message === "string" && error.message
        ? error.message
        : "Unknown error";
    if (message === "Failed to fetch") {
      message = message + " (API: " + getApiUrl("/api/positions") + ")";
    }
    window.alert("Failed to create asset: " + message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = previousBtnText || "Create";
  }
}

async function applyDeleteAsset(event) {
  event.preventDefault();

  const select = document.getElementById("deleteAssetSelect");
  const submitBtn = document.getElementById("deleteAssetSubmitBtn");
  if (!select || !submitBtn || !select.value) {
    return;
  }

  const assetId = select.value;
  const confirmed = window.confirm("Delete asset " + assetId + "?");
  if (!confirmed) {
    return;
  }

  const previousBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Deleting...";

  try {
    await deletePositionOnServer(assetId);
    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
  } catch (error) {
    console.error("Failed to delete asset:", error);
    let message =
      error && typeof error.message === "string" && error.message
        ? error.message
        : "Unknown error";
    if (message === "Failed to fetch") {
      message = message + " (API: " + getApiUrl("/api/positions/" + encodeURIComponent(assetId)) + ")";
    }
    window.alert("Failed to delete asset: " + message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = previousBtnText || "Delete";
    fillDeleteAssetOptions();
  }
}

async function applyTransaction(event) {
  event.preventDefault();

  const form = document.getElementById("transactionForm");
  const typeSelect = document.getElementById("transactionTypeSelect");
  const assetSelect = document.getElementById("transactionAssetSelect");
  const assetIdInput = document.getElementById("transactionAssetIdInput");
  const assetNameInput = document.getElementById("transactionAssetNameInput");
  const currencySelect = document.getElementById("transactionCurrencySelect");
  const quantityInput = document.getElementById("transactionQuantityInput");
  const unitPriceInput = document.getElementById("transactionUnitPriceInput");
  const dateInput = document.getElementById("transactionDateInput");
  const submitBtn = document.getElementById("transactionSubmitBtn");

  if (
    !form ||
    !typeSelect ||
    !assetSelect ||
    !assetIdInput ||
    !assetNameInput ||
    !currencySelect ||
    !quantityInput ||
    !unitPriceInput ||
    !dateInput ||
    !submitBtn
  ) {
    return;
  }

  const quantity = parseCurrencyNumber(quantityInput.value);
  const unitPriceText = unitPriceInput.value.trim();
  const payload = {
    type: typeSelect.value,
    quantity,
    unitPrice: unitPriceText ? parseCurrencyNumber(unitPriceText) : "",
    transactedAt: dateInput.value,
  };

  if (assetSelect.value === NEW_TRANSACTION_ASSET_VALUE) {
    const assetName = assetNameInput.value.trim();
    if (!assetName) {
      window.alert("Asset name is required for a new asset transaction.");
      return;
    }

    const assetId = assetIdInput.value.trim().toUpperCase();
    payload.assetId = assetId;
    payload.assetName = assetName;
    payload.currency = currencySelect.value === "CNY" ? "CNY" : "USD";
  } else {
    payload.assetId = assetSelect.value;
  }

  const previousLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Recording...";

  try {
    await createTransactionOnServer(payload);
    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();

    form.reset();
    fillTransactionAssetOptions(NEW_TRANSACTION_ASSET_VALUE);
    document.getElementById("transactionCurrencySelect").value = "USD";
    setDefaultTransactionDateInput();
  } catch (error) {
    console.error("Failed to record transaction:", error);
    let message =
      error && typeof error.message === "string" && error.message
        ? error.message
        : "Unknown error";
    if (message === "Failed to fetch") {
      message = message + " (API: " + getApiUrl("/api/transactions") + ")";
    }
    window.alert("Failed to record transaction: " + message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = previousLabel || "Record Transaction";
  }
}

function bindPersistenceEvents() {
  const table = document.querySelector(".table-wrap table");
  if (table) {
    table.addEventListener("change", function (event) {
      const target = event.target;
      if (!(target instanceof HTMLSelectElement) || !target.classList.contains("currency-select")) {
        return;
      }
      updateTotals();
    });
  }

  const positionEditorForm = document.getElementById("positionEditorForm");
  const positionAssetSelect = document.getElementById("positionAssetSelect");
  const createAssetForm = document.getElementById("createAssetForm");
  const transactionForm = document.getElementById("transactionForm");
  const transactionAssetSelect = document.getElementById("transactionAssetSelect");
  const deleteAssetForm = document.getElementById("deleteAssetForm");
  const signOutButton = document.getElementById("signout-btn");
  const actionTabs = document.querySelectorAll("[data-action-tab]");
  const historyTabs = document.querySelectorAll("[data-history-range]");
  if (positionEditorForm) {
    positionEditorForm.addEventListener("submit", applyPositionSizeUpdate);
  }
  if (positionAssetSelect) {
    positionAssetSelect.addEventListener("change", handleAssetSelectionChange);
  }
  if (createAssetForm) {
    createAssetForm.addEventListener("submit", applyCreateAsset);
  }
  if (transactionForm) {
    transactionForm.addEventListener("submit", applyTransaction);
  }
  if (transactionAssetSelect) {
    transactionAssetSelect.addEventListener("change", toggleTransactionNewAssetFields);
  }
  if (deleteAssetForm) {
    deleteAssetForm.addEventListener("submit", applyDeleteAsset);
  }
  if (signOutButton) {
    signOutButton.addEventListener("click", signOutFromSession);
  }
  for (let i = 0; i < actionTabs.length; i++) {
    actionTabs[i].addEventListener("click", function () {
      setActiveActionTab(actionTabs[i].getAttribute("data-action-tab"));
    });
  }
  for (let i = 0; i < historyTabs.length; i++) {
    historyTabs[i].addEventListener("click", function () {
      refreshPortfolioHistory(historyTabs[i].getAttribute("data-history-range"));
    });
  }

  window.addEventListener("resize", function () {
    updateAllocationChart();
    if (currentPortfolioHistoryPoints.length) {
      drawPortfolioHistoryChart(currentPortfolioHistoryPoints, activePortfolioHistoryRange);
    }
  });
}

window.replacePortfolioRows = replacePortfolioRows;
setAuthUiState(null);
setActiveActionTab("edit");
setActivePortfolioHistoryRange(activePortfolioHistoryRange);
setPortfolioHistoryState("Sign in to load portfolio history.", { showState: true });
renderPortfolioRows(INITIAL_PORTFOLIO_ROWS);
restoreMarketFeedSnapshot();
migrateCnyRowsPositionPriceSwap();
normalizeAllEditableFields();
updateTotals();
renderMarketDataFooter();
fillPositionEditorOptions();
fillTransactionAssetOptions();
fillDeleteAssetOptions();
syncPositionInputWithSelectedAsset();
setDefaultTransactionDateInput();
renderTransactionsTable([]);
bindPersistenceEvents();
startMarketAutoRefresh();
initGoogleSignInWhenReady(0);
restoreAuthSession();
