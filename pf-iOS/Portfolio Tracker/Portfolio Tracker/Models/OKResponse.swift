import Foundation

/// Generic response for endpoints that return only `{ ok: true }` with no payload,
/// e.g. DELETE /api/positions/:assetId and DELETE /api/transactions/:transactionId.
struct OKResponse: Decodable {
    let ok: Bool
}
