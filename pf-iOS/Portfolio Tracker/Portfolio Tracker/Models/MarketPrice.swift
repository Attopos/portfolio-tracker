import Foundation

/// Live price data for a single asset, sourced from CoinGecko.
/// Only assets with a configured `coingeckoId` in assetRegistryData.json return prices
/// (currently BTC and ETH). Other assets appear in positions but have no market-price entry.
struct MarketPrice: Codable, Hashable {
    let symbol: String
    let usd: Double
    let cny: Double
    /// nil if CoinGecko did not return a 24-hour change figure.
    let usd24hChange: Double?
    let cny24hChange: Double?
    let lastUpdatedAt: Date
    let source: String
}

// MARK: - Response envelope

/// Returned by GET /api/market-prices?assets=BTC,ETH
/// `prices` is keyed by the normalised asset symbol (e.g. "BTC").
struct MarketPricesResponse: Decodable {
    let ok: Bool
    let prices: [String: MarketPrice]
    let fetchedAt: Date
}
