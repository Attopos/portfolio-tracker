import Foundation

struct PositionMetrics {
    let effectivePrice: Double
    let valueInNative: Double
    let valueUSD: Double
    let valueCNY: Double
    let investedNative: Double
    let investedUSD: Double
    let investedCNY: Double
    let gainCNY: Double
    let gainPercent: Double
}

enum PortfolioMetrics {

    /// Mirrors the web's `buildPositionMetrics`. Priority: manualMarketPrice > live market > stored price.
    static func metrics(
        for position: Position,
        marketPrices: [String: MarketPrice],
        fxRate: Double
    ) -> PositionMetrics {
        let price = effectivePrice(for: position, marketPrices: marketPrices)
        let native = position.position * price
        let investedNative = position.position * position.price

        let valueUSD: Double
        let valueCNY: Double
        let investedUSD: Double
        let investedCNY: Double

        if position.currency == .cny {
            valueCNY = native
            valueUSD = fxRate > 0 ? native / fxRate : 0
            investedCNY = investedNative
            investedUSD = fxRate > 0 ? investedNative / fxRate : 0
        } else {
            valueUSD = native
            valueCNY = native * fxRate
            investedUSD = investedNative
            investedCNY = investedNative * fxRate
        }

        let gainCNY = valueCNY - investedCNY

        return PositionMetrics(
            effectivePrice: price,
            valueInNative: native,
            valueUSD: valueUSD,
            valueCNY: valueCNY,
            investedNative: investedNative,
            investedUSD: investedUSD,
            investedCNY: investedCNY,
            gainCNY: gainCNY,
            gainPercent: investedCNY > 0 ? (gainCNY / investedCNY) * 100 : 0
        )
    }

    static func effectivePrice(
        for position: Position,
        marketPrices: [String: MarketPrice]
    ) -> Double {
        if let manual = position.manualMarketPrice { return manual }
        let symbol = position.id.uppercased()
        if let market = marketPrices[symbol] {
            return position.currency == .cny ? market.cny : market.usd
        }
        return position.price
    }

    static func totalValueCNY(
        positions: [Position],
        marketPrices: [String: MarketPrice],
        fxRate: Double
    ) -> Double {
        positions.reduce(0) { $0 + metrics(for: $1, marketPrices: marketPrices, fxRate: fxRate).valueCNY }
    }

    static func totalValueUSD(
        positions: [Position],
        marketPrices: [String: MarketPrice],
        fxRate: Double
    ) -> Double {
        positions.reduce(0) { $0 + metrics(for: $1, marketPrices: marketPrices, fxRate: fxRate).valueUSD }
    }

}
