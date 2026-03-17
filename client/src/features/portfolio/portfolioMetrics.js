export function getPositionEffectivePrice(position, marketPricesBySymbol) {
  const symbol = position?.standardSymbol || "";
  const entryPrice = Number(position?.price);
  const market = symbol ? marketPricesBySymbol[symbol] : null;

  if (market && typeof market === "object") {
    const marketPrice = position.currency === "CNY" ? Number(market.cny) : Number(market.usd);
    if (Number.isFinite(marketPrice) && marketPrice > 0) {
      return marketPrice;
    }
  }

  return Number.isFinite(entryPrice) ? entryPrice : 0;
}

export function getPositionDisplaySymbol(position) {
  const symbol = String(position?.standardSymbol || position?.id || position?.name || "")
    .trim()
    .toUpperCase()
    .slice(0, 5);

  return symbol || String(position?.name || "").trim().slice(0, 3).toUpperCase();
}

export function buildPositionMetrics(position, marketPricesBySymbol, cnyPerUsdRate) {
  const quantity = Number(position?.position) || 0;
  const entryPrice = Number(position?.price) || 0;
  const effectivePrice = getPositionEffectivePrice(position, marketPricesBySymbol);
  const investedBase = quantity * entryPrice;
  const baseValue = quantity * effectivePrice;
  const usdValue = position?.currency === "CNY" ? baseValue / cnyPerUsdRate : baseValue;
  const cnyValue = position?.currency === "CNY" ? baseValue : usdValue * cnyPerUsdRate;
  const investedUsd = position?.currency === "CNY" ? investedBase / cnyPerUsdRate : investedBase;
  const pnlUsd = usdValue - investedUsd;
  const pnlPercent = investedUsd > 0 ? (pnlUsd / investedUsd) * 100 : 0;

  return {
    ...position,
    cnyValue,
    effectivePrice,
    investedUsd,
    pnlPercent,
    pnlUsd,
    quantity,
    symbol: getPositionDisplaySymbol(position),
    usdValue,
  };
}
