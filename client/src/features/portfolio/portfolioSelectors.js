import { VALUE_FORMATTER, formatRate } from "../../lib/formatters.js";

export function getEffectivePrice(item, marketPricesBySymbol) {
  const symbol = item?.standardSymbol || "";
  const entryPrice = Number(item?.price);
  const market = symbol ? marketPricesBySymbol[symbol] : null;

  if (market && typeof market === "object") {
    const marketPrice = item.currency === "CNY" ? Number(market.cny) : Number(market.usd);
    if (Number.isFinite(marketPrice) && marketPrice > 0) {
      return marketPrice;
    }
  }

  return Number.isFinite(entryPrice) ? entryPrice : 0;
}

export function buildMarketFooterText(cnyPerUsdRate, marketPricesBySymbol, lastMarketSyncAt) {
  const summaries = Object.keys(marketPricesBySymbol)
    .map((symbol) => {
      const usd = Number(marketPricesBySymbol[symbol]?.usd);
      return Number.isFinite(usd) && usd > 0 ? symbol + " $" + VALUE_FORMATTER.format(usd) : "";
    })
    .filter(Boolean);

  const syncedAt = lastMarketSyncAt ? " | Updated: " + lastMarketSyncAt : "";
  const marketText = summaries.length ? " | " + summaries.join(" | ") : "";
  return "FX USD/CNY: " + formatRate(cnyPerUsdRate) + marketText + syncedAt;
}
