import Foundation

/// USD/CNY exchange rate as returned by GET /api/fx-rate.
/// The backend spreads the rate fields directly into the top-level JSON object
/// (no nested key), so this struct decodes the entire response.
/// Source: frankfurter.app, cached server-side for 15 minutes.
/// Falls back to 6.91 if the upstream call fails.
struct FXRateResponse: Decodable {
    let ok: Bool
    let base: String
    let quote: String
    let rate: Double
    let source: String
    let fetchedAt: Date
}
