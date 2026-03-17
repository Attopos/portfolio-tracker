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
