import Foundation

/// A recorded trade or position adjustment.
/// The server transforms DB columns through `buildTransactionResponse`, so all fields
/// arrive as camelCase — no custom CodingKeys needed except for `transactionType`,
/// which maps to the JSON key "type" (avoided as a Swift property name for clarity).
struct Transaction: Codable, Identifiable, Hashable {
    let id: Int
    let assetId: String
    let assetName: String
    let currency: Currency
    let transactionType: TransactionType
    let quantity: Double
    /// nil when not supplied at record time (e.g. a "set" operation with no explicit price).
    let unitPrice: Double?
    let positionAfter: Double
    let transactedAt: Date
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case assetId
        case assetName
        case currency
        case transactionType = "type"
        case quantity
        case unitPrice
        case positionAfter
        case transactedAt
        case createdAt
    }
}

// MARK: - Response envelopes

/// Returned by GET /api/transactions. Limited to the 25 most recent by the backend.
struct TransactionsResponse: Decodable {
    let ok: Bool
    let transactions: [Transaction]
}

/// Returned by POST /api/transactions (HTTP 201).
struct TransactionResponse: Decodable {
    let ok: Bool
    let transaction: Transaction
}
