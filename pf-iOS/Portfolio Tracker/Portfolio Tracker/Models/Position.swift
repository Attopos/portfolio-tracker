import Foundation

/// A single holding as returned by GET /api/positions and PUT /api/positions/:assetId.
/// The server returns raw DB columns, so most fields arrive in snake_case.
/// `id` is an asset slug string (e.g. "btc", "custom-stock-1720000000000").
struct Position: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let currency: Currency
    /// Current quantity held.
    let position: Double
    /// Last transacted unit price, stored at trade time.
    let price: Double
    /// User-set override price; takes precedence over live market price when non-nil.
    let manualMarketPrice: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case currency
        case position
        case price
        case manualMarketPrice = "manual_market_price"
    }
}

// MARK: - Response envelopes

struct PositionsResponse: Decodable {
    let ok: Bool
    let positions: [Position]
}

/// Returned by PUT /api/positions/:assetId.
struct PositionResponse: Decodable {
    let ok: Bool
    let position: Position
}
