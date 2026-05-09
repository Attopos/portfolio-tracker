import Foundation

/// Asset denomination currency. Matches the backend's allowed values for positions and transactions.
enum Currency: String, Codable, Hashable, CaseIterable {
    case usd = "USD"
    case cny = "CNY"
}

/// The three transaction kinds the backend accepts and records.
enum TransactionType: String, Codable, Hashable, CaseIterable {
    case buy
    case sell
    case set
}
