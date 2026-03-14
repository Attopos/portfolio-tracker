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
const MAX_ALLOCATION_SEGMENTS = 6;
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
const STANDARD_MARKET_ASSETS = {
  BTC: {
    symbol: "BTC",
    aliases: ["BTC", "BITCOIN"],
  },
  ETH: {
    symbol: "ETH",
    aliases: ["ETH", "ETHEREUM"],
  },
};
let cnyPerUsdRate = DEFAULT_CNY_PER_USD;
let lastMarketSyncAt = "";
let lastMarketRequestAt = 0;
let marketConsecutiveFailures = 0;
let marketRefreshTimerId = null;
let marketRefreshInFlight = false;
let marketPricesBySymbol = {};
let currentLocalUserId = null;
let currentLocalUserProfile = null;
let activePortfolioHistoryRange = "30d";
let portfolioHistoryRequestId = 0;
let currentPortfolioHistoryPoints = [];
let currentTransactions = [];
let currentPortfolioRows = [];
let positionEditSuccessTimerId = null;
let allocationChartInstance = null;
let portfolioHistoryChartInstance = null;
let isAuthMenuOpen = false;
let isAddMenuOpen = false;
let isPageActionOpen = false;
const STANDARD_MARKET_ALIAS_LOOKUP = buildStandardMarketAliasLookup();

// Small UI helper for Google auth status text.
function setAuthStatus(message, isError) {
  const statusEl = document.getElementById("auth-status");
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ff9f9f" : "";
}

function syncTopbarOffset() {
  const topbarEl = document.querySelector(".topbar");
  if (!topbarEl) {
    return;
  }

  const height = Math.ceil(topbarEl.getBoundingClientRect().height);
  if (height > 0) {
    document.documentElement.style.setProperty("--topbar-height", height + "px");
  }
}

function isSignInPage() {
  return /\/signin\.html$/i.test(window.location.pathname);
}

function getPostAuthRedirectPath() {
  const params = new URLSearchParams(window.location.search);
  const rawNext = String(params.get("next") || "").trim();
  if (!rawNext) {
    return "index.html";
  }

  if (/^(?:[a-z]+:)?\/\//i.test(rawNext) || rawNext.startsWith("//")) {
    return "index.html";
  }

  return rawNext.replace(/^\.?\//, "") || "index.html";
}

function setAuthMenuOpen(nextOpen) {
  const menuPanelEl = document.getElementById("auth-menu-panel");
  const menuTriggerEl = document.getElementById("auth-avatar-trigger");
  const shouldOpen = Boolean(nextOpen && menuPanelEl && menuTriggerEl);

  isAuthMenuOpen = shouldOpen;

  if (menuPanelEl) {
    menuPanelEl.hidden = !shouldOpen;
  }

  if (menuTriggerEl) {
    menuTriggerEl.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  syncTopbarOffset();
}

function setAddMenuOpen(nextOpen) {
  const menuPanelEl = document.getElementById("add-menu-panel");
  const menuTriggerEl = document.getElementById("add-menu-trigger");
  const shouldOpen = Boolean(nextOpen && menuPanelEl && menuTriggerEl);

  isAddMenuOpen = shouldOpen;

  if (menuPanelEl) {
    menuPanelEl.hidden = !shouldOpen;
  }

  if (menuTriggerEl) {
    menuTriggerEl.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  syncTopbarOffset();
}

function setPageActionOpen(nextOpen) {
  const panelEl = document.getElementById("page-action-panel");
  const triggerEl = document.getElementById("page-action-trigger");
  const shouldOpen = Boolean(nextOpen && panelEl && triggerEl);

  isPageActionOpen = shouldOpen;

  if (panelEl) {
    panelEl.hidden = !shouldOpen;
  }

  if (triggerEl) {
    triggerEl.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  }

  syncTopbarOffset();
}

function getDefaultActionTab() {
  const firstPanel = document.querySelector("[data-action-panel]");
  return firstPanel ? String(firstPanel.getAttribute("data-action-panel") || "").trim() : "";
}

function getRequestedActionTab() {
  const params = new URLSearchParams(window.location.search);
  const action = String(params.get("action") || "").trim();
  if (!action) {
    return "";
  }

  const panel = document.querySelector('[data-action-panel="' + action + '"]');
  return panel ? action : "";
}

function setAuthUiState(user) {
  const loggedOutEl = document.getElementById("auth-logged-out");
  const loggedInEl = document.getElementById("auth-logged-in");
  const avatarEl = document.getElementById("auth-user-avatar");
  const avatarFallbackEl = document.getElementById("auth-user-avatar-fallback");
  const signOutButton = document.getElementById("signout-btn");
  const hasUser = Boolean(user && user.id);
  const avatarUrl = hasUser ? String(user.avatar_url || user.picture || "").trim() : "";

  if (loggedOutEl) {
    loggedOutEl.classList.toggle("auth-state-hidden", hasUser);
  }

  if (loggedInEl) {
    loggedInEl.classList.toggle("auth-state-hidden", !hasUser);
  }

  if (!hasUser) {
    setAuthMenuOpen(false);
  }

  if (avatarEl) {
    if (hasUser && avatarUrl) {
      avatarEl.src = avatarUrl;
      avatarEl.onerror = function () {
        avatarEl.removeAttribute("src");
        avatarEl.classList.add("auth-state-hidden");
        if (avatarFallbackEl) {
          avatarFallbackEl.classList.remove("auth-state-hidden");
        }
        syncTopbarOffset();
      };
      avatarEl.classList.remove("auth-state-hidden");
    } else {
      avatarEl.removeAttribute("src");
      avatarEl.onerror = null;
      avatarEl.classList.add("auth-state-hidden");
    }
  }

  if (avatarFallbackEl) {
    avatarFallbackEl.classList.toggle("auth-state-hidden", hasUser && Boolean(avatarUrl));
  }

  if (signOutButton) {
    const label = hasUser
      ? String(user.name || user.email || "Google user").trim() || "Google user"
      : "Guest";
    signOutButton.setAttribute("aria-label", "Sign out " + label);
    signOutButton.title = "Sign out";
  }

  syncTopbarOffset();
}

function clearAuthenticatedPortfolioView() {
  replacePortfolioRows([]);
  currentPortfolioHistoryPoints = [];
  currentTransactions = [];
  marketPricesBySymbol = {};
  renderTransactionsTable([]);
  setPortfolioHistoryState("Sign in to load portfolio history.", { showState: true });
}

function buildStandardMarketAliasLookup() {
  const map = Object.create(null);
  const symbols = Object.keys(STANDARD_MARKET_ASSETS);

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const asset = STANDARD_MARKET_ASSETS[symbol];
    for (let j = 0; j < asset.aliases.length; j++) {
      map[asset.aliases[j]] = symbol;
    }
    map[symbol] = symbol;
  }

  return map;
}

function normalizeMarketAssetSymbol(value) {
  const key = String(value || "")
    .trim()
    .toUpperCase();
  return STANDARD_MARKET_ALIAS_LOOKUP[key] || "";
}

function detectStandardMarketSymbol(assetId, assetName) {
  return normalizeMarketAssetSymbol(assetId) || normalizeMarketAssetSymbol(assetName);
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

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    let data = null;
    let rawText = "";
    if (contentType.includes("application/json")) {
      data = await res.json();
    } else {
      rawText = await res.text();
    }
    console.log("Backend auth response:", data);

    if (!res.ok || !data || data.ok !== true) {
      let message = data && data.error ? data.error : "Google token verification failed.";
      if (!data && rawText) {
        const compactText = rawText.replace(/\s+/g, " ").trim();
        message =
          "Auth endpoint returned non-JSON response (" +
          res.status +
          "). " +
          compactText.slice(0, 120);
      }
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

    if (isSignInPage()) {
      window.location.href = getPostAuthRedirectPath();
      return;
    }

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
  if (!signInContainer) {
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

  if (signUpContainer) {
    google.accounts.id.renderButton(signUpContainer, {
      type: "standard",
      theme: "filled_black",
      size: "medium",
      text: "signup_with",
      shape: "rectangular",
    });
  }

  setAuthStatus("Google sign-in button ready.", false);
  syncTopbarOffset();
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

  // Local development serves the frontend on a different port from the API.
  if ((hostname === "localhost" || hostname === "127.0.0.1") && port && port !== "3000") {
    return protocol + "//" + hostname + ":3000";
  }

  // In production, prefer same-origin requests and let the web server / reverse proxy
  // route /api and /auth to the backend. Use window.__API_BASE_URL to override.
  return "";
}

function buildFetchOptions(options) {
  const nextOptions = options && typeof options === "object" ? { ...options } : {};
  nextOptions.credentials = "include";
  return nextOptions;
}

function setActiveActionTab(nextTab) {
  const targetTab = String(nextTab || "").trim() || getDefaultActionTab();
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

function formatCompactCny(value) {
  const absValue = Math.abs(value);
  if (absValue >= 1000000) {
    return "¥" + (value / 1000000).toFixed(1) + "M";
  }
  if (absValue >= 1000) {
    return "¥" + (value / 1000).toFixed(1) + "K";
  }
  return "¥" + value.toFixed(0);
}

function formatHistoryAxisCny(value, span, precisionBoost) {
  const absValue = Math.abs(value);
  const safeSpan = Math.abs(Number(span)) || 0;
  const extraPrecision = Math.max(0, Number(precisionBoost) || 0);

  if (absValue >= 1000000) {
    const decimals = (safeSpan >= 100000 ? 1 : safeSpan >= 10000 ? 2 : safeSpan >= 1000 ? 3 : 4) + extraPrecision;
    return "¥" + (value / 1000000).toFixed(decimals) + "M";
  }

  if (absValue >= 1000) {
    const decimals = (safeSpan >= 10000 ? 1 : safeSpan >= 1000 ? 2 : safeSpan >= 100 ? 3 : 4) + extraPrecision;
    return "¥" + (value / 1000).toFixed(decimals) + "K";
  }

  const decimals = (safeSpan >= 10 ? 0 : safeSpan >= 1 ? 1 : 2) + extraPrecision;
  return "¥" + value.toFixed(decimals);
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

  const bottomPadding = Math.max(valueRange * 0.2, referenceValue * 0.005, 1);
  const topPadding = Math.max(valueRange * 0.08, referenceValue * 0.002, 1);

  return {
    values: numericValues,
    minValue,
    maxValue,
    displayMinValue: minValue - bottomPadding,
    displayMaxValue: maxValue + topPadding,
    displaySpan: valueRange + bottomPadding + topPadding,
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

function getHistoryMonthKey(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function formatHistoryAxisDate(dateString, range) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (range === "1y") {
    return String(date.getMonth() + 1).padStart(2, "0") + "/" + String(date.getFullYear()).slice(-2);
  }

  return (
    String(date.getMonth() + 1).padStart(2, "0") +
    "/" +
    String(date.getDate()).padStart(2, "0")
  );
}

function formatHistoryTooltipDate(dateString, range) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  if (range === "1y") {
    return String(date.getFullYear()) + "-" + String(date.getMonth() + 1).padStart(2, "0");
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

  const bucketKeyBuilder = range === "1y" ? getHistoryMonthKey : getHistoryDateKey;
  const lastPointByBucket = new Map();
  for (let i = 0; i < normalizedPoints.length; i++) {
    const point = normalizedPoints[i];
    const bucketKey = bucketKeyBuilder(point.capturedAt);
    if (!bucketKey) {
      continue;
    }
    lastPointByBucket.set(bucketKey, point);
  }

  return Array.from(lastPointByBucket.values()).sort(function (left, right) {
    return new Date(left.capturedAt).getTime() - new Date(right.capturedAt).getTime();
  });
}

function buildInitialPortfolioHistoryPoint() {
  if (!Array.isArray(currentPortfolioRows) || currentPortfolioRows.length === 0) {
    return null;
  }

  let totalUsd = 0;
  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const item = currentPortfolioRows[i];
    const price = getEffectivePriceForItem(item);
    const baseValue = Number(item.position) * price;

    if (!Number.isFinite(baseValue)) {
      continue;
    }

    if (item.currency === "CNY") {
      totalUsd += baseValue / cnyPerUsdRate;
    } else {
      totalUsd += baseValue;
    }
  }

  if (!Number.isFinite(totalUsd) || totalUsd <= 0) {
    return null;
  }

  return {
    totalUsd,
    capturedAt: new Date().toISOString(),
  };
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
      return formatHistoryAxisCny(tick, span, precisionBoost);
    });
    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }

  return ticks.map(function (tick) {
    return "¥" + tick.toFixed(2);
  });
}

function getPortfolioHistoryChartInstance() {
  const chartEl = document.getElementById("portfolioHistoryChart");
  if (!chartEl || typeof window.echarts === "undefined") {
    return null;
  }

  if (!portfolioHistoryChartInstance || portfolioHistoryChartInstance.isDisposed()) {
    portfolioHistoryChartInstance = window.echarts.init(chartEl, null, {
      renderer: "canvas",
    });
  }

  return portfolioHistoryChartInstance;
}

function drawPortfolioHistoryChart(points, range) {
  const chart = getPortfolioHistoryChartInstance();
  if (!chart || !Array.isArray(points) || !points.length) {
    return;
  }

  const values = points.map(function (point) {
    return (Number(point.totalUsd) || 0) * cnyPerUsdRate;
  });
  const normalizedValues = normalizeHistoryValues(values);
  const axis = buildHistoryAxisTicks(normalizedValues.displayMinValue, normalizedValues.displayMaxValue, 4);
  const categories = points.map(function (point) {
    return formatHistoryAxisDate(point.capturedAt, range);
  });
  const seriesData = points.map(function (point, index) {
    return {
      value: normalizedValues.values[index],
      rawDate: point.capturedAt,
      rawUsd: Number(point.totalUsd) || 0,
    };
  });
  const splitNumber = range === "1y" ? Math.min(6, Math.max(3, categories.length)) : Math.min(7, Math.max(3, categories.length));

  chart.setOption(
    {
      animationDuration: 450,
      animationDurationUpdate: 300,
      grid: {
        top: 24,
        right: 24,
        bottom: 44,
        left: 76,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(8, 18, 32, 0.94)",
        borderColor: "rgba(146, 195, 255, 0.24)",
        borderWidth: 1,
        textStyle: {
          color: "#e8f2ff",
          fontFamily: "JetBrains Mono, Menlo, monospace",
          fontSize: 12,
        },
        axisPointer: {
          type: "line",
          lineStyle: {
            color: "rgba(139, 195, 255, 0.28)",
            width: 1,
          },
        },
        formatter: function (items) {
          const point = Array.isArray(items) && items.length ? items[0] : null;
          if (!point || !point.data) {
            return "";
          }

          return [
            formatHistoryTooltipDate(point.data.rawDate, range),
            "¥" + VALUE_FORMATTER.format(point.data.value),
            "$" + VALUE_FORMATTER.format(point.data.rawUsd),
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: categories,
        axisTick: {
          show: false,
        },
        axisLine: {
          lineStyle: {
            color: "rgba(139, 195, 255, 0.18)",
          },
        },
        axisLabel: {
          color: "#7c93a8",
          fontFamily: "JetBrains Mono, Menlo, monospace",
          fontSize: 11,
          interval: "auto",
          hideOverlap: true,
        },
        splitNumber,
      },
      yAxis: {
        type: "value",
        min: axis.minValue,
        max: axis.maxValue,
        interval: axis.step,
        axisTick: {
          show: false,
        },
        axisLine: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            color: "rgba(139, 195, 255, 0.12)",
          },
        },
        axisLabel: {
          color: "#7c93a8",
          fontFamily: "JetBrains Mono, Menlo, monospace",
          fontSize: 11,
          formatter: function (value) {
            return formatHistoryAxisCny(value, axis.maxValue - axis.minValue, 0);
          },
        },
      },
      series: [
        {
          type: "line",
          data: seriesData,
          smooth: true,
          symbol: "circle",
          symbolSize: range === "1y" ? 7 : 6,
          showSymbol: true,
          lineStyle: {
            width: 3,
            color: "#22e3a4",
          },
          itemStyle: {
            color: "#22e3a4",
            borderColor: "#08131d",
            borderWidth: 2,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(34, 227, 164, 0.28)" },
                { offset: 1, color: "rgba(34, 227, 164, 0.03)" },
              ],
            },
          },
          emphasis: {
            focus: "series",
          },
        },
      ],
    },
    true
  );
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
      const initialPoint = buildInitialPortfolioHistoryPoint();
      if (!initialPoint) {
        currentPortfolioHistoryPoints = [];
        setPortfolioHistoryState("No historical snapshots yet. Your history will appear as you use the portfolio.", {
          showState: true,
        });
        return;
      }

      currentPortfolioHistoryPoints = [initialPoint];
      setPortfolioHistoryState("", { showState: false });
      drawPortfolioHistoryChart([initialPoint], nextRange);
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
    standardSymbol: detectStandardMarketSymbol(id, name),
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
    '" data-entry-price="' +
    escapeHtml(String(Number(item.price) || 0)) +
    '" data-standard-symbol="' +
    escapeHtml(item.standardSymbol || "") +
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
  const normalizedItems = [];
  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const normalized = normalizePortfolioRow(items[i]);
      if (normalized) {
        normalizedItems.push(normalized);
      }
    }
  }

  currentPortfolioRows = normalizedItems;

  const tableBody = document.getElementById("portfolioTableBody");
  if (!tableBody) {
    return;
  }

  if (!normalizedItems.length) {
    tableBody.innerHTML = "";
    return;
  }

  let html = "";

  for (let i = 0; i < normalizedItems.length; i++) {
    html += buildPortfolioRowHtml(normalizedItems[i]);
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
  scheduleNextMarketRefresh(0);
}

function getApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : "/" + path;
  return API_BASE_URL + normalizedPath;
}

function getDataRows() {
  return document.querySelectorAll("#portfolioTableBody tr");
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

function getPortfolioItemById(assetId) {
  const safeAssetId = String(assetId || "").trim();
  for (let i = 0; i < currentPortfolioRows.length; i++) {
    if (currentPortfolioRows[i].id === safeAssetId) {
      return currentPortfolioRows[i];
    }
  }

  return null;
}

function getRowAssetName(row) {
  const cell = row && row.cells ? row.cells[0] : null;
  return cell ? String(cell.textContent || "").trim() : "";
}

function getRowEntryPrice(row) {
  const raw = row ? row.getAttribute("data-entry-price") : "";
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function getRowStandardSymbol(row) {
  const symbol = row ? String(row.getAttribute("data-standard-symbol") || "").trim().toUpperCase() : "";
  if (symbol) {
    return symbol;
  }
  return detectStandardMarketSymbol(getRowId(row), getRowAssetName(row));
}

function getTrackedMarketSymbols() {
  const symbols = [];
  const seen = new Set();

  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const symbol = currentPortfolioRows[i].standardSymbol || "";
    if (!symbol || seen.has(symbol)) {
      continue;
    }
    seen.add(symbol);
    symbols.push(symbol);
  }

  return symbols;
}

function syncPortfolioRowsFromTable() {
  const rows = getDataRows();
  if (!rows.length || !currentPortfolioRows.length) {
    return;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const item = getPortfolioItemById(getRowId(row));
    const currencySelect = row.querySelector(".currency-select");
    if (!item || !currencySelect) {
      continue;
    }

    item.currency = currencySelect.value === "CNY" ? "CNY" : "USD";
  }
}

function getEffectivePriceForItem(item) {
  const symbol = item && item.standardSymbol ? item.standardSymbol : "";
  const entryPrice = Number(item && item.price);
  if (!symbol) {
    return Number.isFinite(entryPrice) ? entryPrice : 0;
  }

  const market = marketPricesBySymbol[symbol];
  if (!market || typeof market !== "object") {
    return Number.isFinite(entryPrice) ? entryPrice : 0;
  }

  const currency = item && item.currency === "CNY" ? "CNY" : "USD";
  const marketPrice = currency === "CNY" ? Number(market.cny) : Number(market.usd);
  if (Number.isFinite(marketPrice) && marketPrice > 0) {
    return marketPrice;
  }

  return Number.isFinite(entryPrice) ? entryPrice : 0;
}

function getEffectivePriceForRow(row) {
  const item = getPortfolioItemById(getRowId(row));
  return getEffectivePriceForItem(item);
}

function formatTransactionDate(dateString) {
  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }
  return parsed.toLocaleString();
}

function updateTransactionsSummary(items) {
  const summaryTransactionsEl = document.getElementById("summaryTransactionsCount");
  if (!summaryTransactionsEl) {
    return;
  }

  summaryTransactionsEl.textContent = String(Array.isArray(items) ? items.length : 0);
}

function renderTransactionsTable(items) {
  updateTransactionsSummary(items);

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
  let optionsHtml = '<option value="">Select holding</option>';

  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const assetId = currentPortfolioRows[i].id;
    const assetName = currentPortfolioRows[i].name;
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
  const nextValue = hasPreviousValue
    ? previousValue
    : currentPortfolioRows.length > 0
      ? String(currentPortfolioRows[0].id || "").trim()
      : "";
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

  const marketSymbols = Object.keys(marketPricesBySymbol);
  const marketSummary = [];
  for (let i = 0; i < marketSymbols.length; i++) {
    const symbol = marketSymbols[i];
    const market = marketPricesBySymbol[symbol];
    const usd = Number(market && market.usd);
    if (!Number.isFinite(usd) || usd <= 0) {
      continue;
    }
    marketSummary.push(symbol + " $" + VALUE_FORMATTER.format(usd));
  }

  footerEl.textContent =
    "FX USD/CNY: " +
    formatRate(cnyPerUsdRate) +
    (marketSummary.length ? " | " + marketSummary.join(" | ") : "");
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

async function fetchMarketPricesFromServer(symbols) {
  const safeSymbols = Array.isArray(symbols)
    ? symbols
        .map(function (symbol) {
          return normalizeMarketAssetSymbol(symbol);
        })
        .filter(Boolean)
    : [];

  if (safeSymbols.length === 0) {
    return {};
  }

  const res = await fetch(
    getApiUrl("/api/market-prices?assets=" + encodeURIComponent(safeSymbols.join(","))),
    buildFetchOptions()
  );

  if (!res.ok) {
    let message = "Failed to fetch market prices";
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
  return payload && payload.prices && typeof payload.prices === "object" ? payload.prices : {};
}

async function refreshMarketData() {
  setCryptoStatus("Market auto-update: syncing FX and crypto prices...", false);

  try {
    const trackedSymbols = getTrackedMarketSymbols();
    const results = await Promise.all([refreshUsdCnyRate(), fetchMarketPricesFromServer(trackedSymbols)]);
    cnyPerUsdRate = results[0];
    marketPricesBySymbol = results[1];
    lastMarketSyncAt = new Date().toLocaleString();

    updateTotals();
    saveMarketFeedSnapshot();
    renderMarketDataFooter();

    setCryptoStatus("Market auto-update: synced at " + lastMarketSyncAt, false);
    return true;
  } catch (error) {
    console.error("Failed to refresh FX data:", error);
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
    const item = getPortfolioItemById(getRowId(row));
    const currencySelect = row.querySelector(".currency-select");
    const positionCell = row.querySelector(".position");
    const priceCell = row.querySelector(".price");
    const usdCell = row.querySelector(".usd");
    const cnyCell = row.querySelector(".cny");

    if (!currencySelect || !positionCell || !priceCell || !usdCell || !cnyCell) {
      continue;
    }

    const position = item ? Number(item.position) : parseCurrencyNumber(positionCell.textContent);
    const price = item ? getEffectivePriceForItem(item) : getEffectivePriceForRow(row);
    priceCell.textContent = VALUE_FORMATTER.format(price);
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

  let html = '<option value="" selected>Select an asset...</option>';

  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const item = currentPortfolioRows[i];
    if (!item.id || !item.name) {
      continue;
    }

    html += '<option value="' + item.id + '">' + item.name + "</option>";
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
  if (!currentPortfolioRows.length) {
    select.innerHTML = '<option value="" selected>No assets available</option>';
    select.disabled = true;
    if (submitBtn) {
      submitBtn.disabled = true;
    }
    return;
  }

  let html = "";
  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const item = currentPortfolioRows[i];
    if (!item.id || !item.name) {
      continue;
    }

    html += '<option value="' + item.id + '">' + item.name + "</option>";
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
  const item = getPortfolioItemById(select.value);
  const position = item ? Number(item.position) : 0;
  input.value = String(Number.isFinite(position) ? position : 0);
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

  const item = getPortfolioItemById(select.value);
  if (!item) {
    return;
  }

  const nextValue = parseCurrencyNumber(input.value);
  const safeValue = Number.isFinite(nextValue) ? nextValue : 0;
  const currentUnitPrice = Number(item.price);
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
    await createTransactionOnServer({
      assetId: select.value,
      type: "set",
      quantity: safeValue,
      unitPrice: Number.isFinite(currentUnitPrice) ? currentUnitPrice : "",
    });

    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();
    syncPositionInputWithSelectedAsset();
    showPositionEditSuccessFeedback(getRowByAssetId(select.value));
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
  const allocation = [];

  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const item = currentPortfolioRows[i];
    const price = getEffectivePriceForItem(item);
    const baseValue = Number(item.position) * price;
    const value =
      item.currency === "CNY" ? baseValue / cnyPerUsdRate : baseValue;
    if (value <= 0) {
      continue;
    }

    allocation.push({
      label: item.name,
      value,
    });
  }

  return allocation;
}

function truncateAllocationLabel(label, maxLength) {
  if (typeof label !== "string") {
    return "";
  }

  const trimmed = label.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return trimmed.slice(0, Math.max(0, maxLength - 1)) + "…";
}

function buildAllocationSegments(items) {
  const sortedItems = items.slice().sort(function (a, b) {
    return b.value - a.value;
  });

  if (sortedItems.length <= MAX_ALLOCATION_SEGMENTS) {
    return sortedItems;
  }

  const visibleItems = sortedItems.slice(0, MAX_ALLOCATION_SEGMENTS - 1);
  let othersValue = 0;

  for (let i = MAX_ALLOCATION_SEGMENTS - 1; i < sortedItems.length; i++) {
    othersValue += sortedItems[i].value;
  }

  if (othersValue > 0) {
    visibleItems.push({
      label: "Others",
      value: othersValue,
    });
  }

  return visibleItems;
}

function getAllocationChartInstance() {
  const chartEl = document.getElementById("allocationChart");
  if (!chartEl || typeof window.echarts === "undefined") {
    return null;
  }

  if (!allocationChartInstance || allocationChartInstance.isDisposed()) {
    allocationChartInstance = window.echarts.init(chartEl, null, {
      renderer: "canvas",
    });
  }

  return allocationChartInstance;
}

function drawAllocationPieChart(items) {
  const chart = getAllocationChartInstance();
  if (!chart) {
    return;
  }

  const total = items.reduce(function (sum, item) {
    return sum + item.value;
  }, 0);
  const isCompact = window.innerWidth <= 640;
  const totalCny = total * cnyPerUsdRate;

  if (!total) {
    chart.clear();
    chart.setOption({
      animation: false,
      title: {
        text: "No allocation data",
        left: "center",
        top: "center",
        textStyle: {
          color: "#7c93a8",
          fontSize: 14,
          fontFamily: "JetBrains Mono, Menlo, monospace",
          fontWeight: "normal",
        },
      },
    });
    return;
  }

  const data = items.map(function (item, index) {
    return {
      value: Number(item.value),
      name: item.label,
      itemStyle: {
        color: PIE_COLORS[index % PIE_COLORS.length],
      },
    };
  });

  chart.setOption(
    {
      animationDuration: 500,
      animationDurationUpdate: 350,
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(8, 18, 32, 0.94)",
        borderColor: "rgba(146, 195, 255, 0.24)",
        borderWidth: 1,
        textStyle: {
          color: "#e8f2ff",
          fontFamily: "JetBrains Mono, Menlo, monospace",
          fontSize: 12,
        },
        formatter: function (params) {
          const usdValue = "$" + VALUE_FORMATTER.format(params.value);
          const cnyValue = "¥" + VALUE_FORMATTER.format(params.value * cnyPerUsdRate);
          return [
            String(params.name || ""),
            params.percent.toFixed(1) + "%",
            usdValue,
            cnyValue,
          ].join("<br/>");
        },
      },
      series: [
        {
          name: "Allocation",
          type: "pie",
          radius: isCompact ? ["44%", "68%"] : ["48%", "74%"],
          center: ["50%", "50%"],
          startAngle: 90,
          clockwise: true,
          minAngle: 4,
          avoidLabelOverlap: false,
          selectedMode: false,
          roseType: false,
          itemStyle: {
            borderColor: "#111b2a",
            borderWidth: 2,
          },
          emphasis: {
            scale: true,
            scaleSize: isCompact ? 6 : 8,
            itemStyle: {
              shadowBlur: 18,
              shadowColor: "rgba(0, 0, 0, 0.22)",
            },
          },
          label: {
            show: false,
          },
          labelLine: {
            show: false,
          },
          data,
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: isCompact ? "41%" : "40%",
          silent: true,
          style: {
            text: "Portfolio",
            fill: "#7c93a8",
            font: (isCompact ? "12px" : "13px") + " JetBrains Mono, Menlo, monospace",
            textAlign: "center",
          },
        },
        {
          type: "text",
          left: "center",
          top: isCompact ? "47%" : "46.5%",
          silent: true,
          style: {
            text: "¥" + VALUE_FORMATTER.format(totalCny),
            fill: "#22e3a4",
            font: "700 " + (isCompact ? "18px" : "22px") + " JetBrains Mono, Menlo, monospace",
            textAlign: "center",
          },
        },
        {
          type: "text",
          left: "center",
          top: isCompact ? "55.5%" : "55%",
          silent: true,
          style: {
            text: "$" + VALUE_FORMATTER.format(total),
            fill: "#a8ceff",
            font: (isCompact ? "11px" : "12px") + " JetBrains Mono, Menlo, monospace",
            textAlign: "center",
          },
        },
      ],
    },
    true
  );
}

function updateAllocationChart() {
  const items = buildAllocationSegments(getAllocationData());
  drawAllocationPieChart(items);
}

function updateTotals() {
  syncPortfolioRowsFromTable();
  updateMarketValues();

  let usdTotal = 0;
  let cnyTotal = 0;
  const holdingsCount = currentPortfolioRows.length;

  for (let i = 0; i < currentPortfolioRows.length; i++) {
    const item = currentPortfolioRows[i];
    const price = getEffectivePriceForItem(item);
    const baseValue = Number(item.position) * price;
    if (item.currency === "CNY") {
      cnyTotal += baseValue;
      usdTotal += baseValue / cnyPerUsdRate;
    } else {
      usdTotal += baseValue;
      cnyTotal += baseValue * cnyPerUsdRate;
    }
  }

  const usdTotalCell = document.getElementById("usdTotal");
  const cnyTotalCell = document.getElementById("cnyTotal");

  if (usdTotalCell) {
    usdTotalCell.textContent = "$" + usdTotal.toFixed(2);
  }

  if (cnyTotalCell) {
    cnyTotalCell.textContent = "¥" + cnyTotal.toFixed(2);
  }

  const summaryHoldingsEl = document.getElementById("summaryHoldingsCount");

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
  let res;
  try {
    res = await fetch(getApiUrl("/api/me"), buildFetchOptions());
  } catch (error) {
    const message =
      error && typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : "Failed to fetch";
    throw new Error(message + " (API: " + getApiUrl("/api/me") + ")");
  }
  if (res.status === 401) {
    return null;
  }

  const contentType = String(res.headers.get("content-type") || "").toLowerCase();

  if (!res.ok) {
    let message = "Failed to restore session";
    if (contentType.includes("application/json")) {
      try {
        const payload = await res.json();
        if (payload && typeof payload.error === "string" && payload.error.trim()) {
          message = payload.error.trim();
        }
      } catch (error) {
        // keep default message
      }
    } else {
      try {
        const rawText = await res.text();
        if (rawText.trim()) {
          message =
            "Session endpoint returned non-JSON response (" +
            res.status +
            "). " +
            rawText.replace(/\s+/g, " ").trim().slice(0, 120);
        }
      } catch (error) {
        // keep default message
      }
    }
    throw new Error(message);
  }

  if (!contentType.includes("application/json")) {
    throw new Error("Session endpoint returned non-JSON response (200).");
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
    if (isSignInPage()) {
      window.location.replace(getPostAuthRedirectPath());
      return;
    }
    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();
    setAuthStatus("Session restored from backend.", false);
  } catch (error) {
    console.error("Failed to restore auth session:", error);
    currentLocalUserId = null;
    currentLocalUserProfile = null;
    setAuthUiState(null);
    const message =
      error && typeof error.message === "string" && error.message.trim()
        ? error.message.trim()
        : "Failed to restore backend session.";
    setAuthStatus(message, true);
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
  const currency = currencySelect.value === "USD" ? "USD" : "CNY";
  const position = parseCurrencyNumber(positionInput.value);
  const price = parseCurrencyNumber(priceInput.value);

  if (!name) {
    window.alert("Name is required.");
    return;
  }

  const previousBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Adding...";

  try {
    await createTransactionOnServer({
      assetName: name,
      currency,
      type: "set",
      quantity: position,
      unitPrice: price,
    });

    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();
    form.reset();
    currencySelect.value = "CNY";
  } catch (error) {
    console.error("Failed to add holding:", error);
    let message =
      error && typeof error.message === "string" && error.message
        ? error.message
        : "Unknown error";
    if (message === "Failed to fetch") {
      message = message + " (API: " + getApiUrl("/api/transactions") + ")";
    }
    window.alert("Failed to add holding: " + message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = previousBtnText || "Add Holding";
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
  const row = getRowByAssetId(assetId);
  const currentUnitPrice = row ? getRowEntryPrice(row) : 0;
  const confirmed = window.confirm("Set holding " + assetId + " to zero?");
  if (!confirmed) {
    return;
  }

  const previousBtnText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Closing...";

  try {
    await createTransactionOnServer({
      assetId,
      type: "set",
      quantity: 0,
      unitPrice: Number.isFinite(currentUnitPrice) ? currentUnitPrice : "",
    });
    const positions = await fetchPositionsFromServer();
    replacePortfolioRows(positions);
    await refreshTransactions();
  } catch (error) {
    console.error("Failed to close holding:", error);
    let message =
      error && typeof error.message === "string" && error.message
        ? error.message
        : "Unknown error";
    if (message === "Failed to fetch") {
      message = message + " (API: " + getApiUrl("/api/transactions") + ")";
    }
    window.alert("Failed to close holding: " + message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = previousBtnText || "Close Holding";
    fillDeleteAssetOptions();
  }
}

async function applyTransaction(event) {
  event.preventDefault();

  const form = document.getElementById("transactionForm");
  const typeSelect = document.getElementById("transactionTypeSelect");
  const assetSelect = document.getElementById("transactionAssetSelect");
  const quantityInput = document.getElementById("transactionQuantityInput");
  const unitPriceInput = document.getElementById("transactionUnitPriceInput");
  const dateInput = document.getElementById("transactionDateInput");
  const submitBtn = document.getElementById("transactionSubmitBtn");

  if (
    !form ||
    !typeSelect ||
    !assetSelect ||
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
    assetId: String(assetSelect.value || "").trim(),
    quantity,
    unitPrice: unitPriceText ? parseCurrencyNumber(unitPriceText) : "",
    transactedAt: dateInput.value,
  };

  if (!payload.assetId) {
    window.alert("Please select a holding first.");
    return;
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
    fillTransactionAssetOptions("");
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
  const authAvatarTrigger = document.getElementById("auth-avatar-trigger");
  const addMenuTrigger = document.getElementById("add-menu-trigger");
  const pageActionTrigger = document.getElementById("page-action-trigger");
  const pageActionClose = document.getElementById("page-action-close");
  const pageActionPanel = document.getElementById("page-action-panel");
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
  if (authAvatarTrigger) {
    authAvatarTrigger.addEventListener("click", function (event) {
      event.stopPropagation();
      setAddMenuOpen(false);
      setAuthMenuOpen(!isAuthMenuOpen);
    });
  }
  if (addMenuTrigger) {
    addMenuTrigger.addEventListener("click", function (event) {
      event.stopPropagation();
      setAuthMenuOpen(false);
      setPageActionOpen(false);
      setAddMenuOpen(!isAddMenuOpen);
    });
  }
  if (pageActionTrigger) {
    pageActionTrigger.addEventListener("click", function (event) {
      event.stopPropagation();
      setAuthMenuOpen(false);
      setAddMenuOpen(false);
      setPageActionOpen(!isPageActionOpen);
    });
  }
  if (pageActionClose) {
    pageActionClose.addEventListener("click", function (event) {
      event.stopPropagation();
      setPageActionOpen(false);
    });
  }
  if (pageActionPanel) {
    pageActionPanel.addEventListener("click", function (event) {
      if (event.target === pageActionPanel) {
        setPageActionOpen(false);
      }
    });
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
    syncTopbarOffset();
    updateAllocationChart();
    if (currentPortfolioHistoryPoints.length) {
      drawPortfolioHistoryChart(currentPortfolioHistoryPoints, activePortfolioHistoryRange);
    }
  });

  document.addEventListener("click", function (event) {
    if (!(event.target instanceof Node)) {
      return;
    }

    const authMenuRoot = document.querySelector(".auth-menu");
    const addMenuRoot = document.querySelector(".add-menu");
    const pageActionRoot = document.querySelector(".page-action-widget");

    if (authMenuRoot && !authMenuRoot.contains(event.target)) {
      setAuthMenuOpen(false);
    }

    if (addMenuRoot && !addMenuRoot.contains(event.target)) {
      setAddMenuOpen(false);
    }

    if (pageActionRoot && !pageActionRoot.contains(event.target)) {
      setPageActionOpen(false);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      setAuthMenuOpen(false);
      setAddMenuOpen(false);
      setPageActionOpen(false);
    }
  });
}

window.replacePortfolioRows = replacePortfolioRows;
setAuthUiState(null);
syncTopbarOffset();
const requestedActionTab = getRequestedActionTab();
setActiveActionTab(requestedActionTab || getDefaultActionTab());
if (requestedActionTab) {
  setPageActionOpen(true);
}
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
