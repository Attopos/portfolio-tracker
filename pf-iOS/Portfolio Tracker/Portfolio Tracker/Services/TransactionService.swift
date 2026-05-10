import Foundation

// MARK: - Request payload (also used by AddTransactionView)

struct CreateTransactionPayload: Encodable {
    let type: TransactionType
    /// nil for a brand-new asset (server will generate the ID).
    let assetId: String?
    let assetName: String
    let currency: Currency
    let quantity: Double
    let unitPrice: Double?
    /// nil → server uses NOW().
    /// Non-nil → sent as ISO8601 via the encoder's .iso8601 date strategy.
    let transactedAt: Date?
}

// MARK: - Service

struct TransactionService {
    private let client: APIClient

    nonisolated init(client: APIClient = .shared) {
        self.client = client
    }

    func fetchAll() async throws -> [Transaction] {
        let response: TransactionsResponse = try await client.get("/api/transactions")
        return response.transactions
    }

    func create(_ payload: CreateTransactionPayload) async throws -> Transaction {
        let response: TransactionResponse = try await client.post("/api/transactions", body: payload)
        return response.transaction
    }

    func delete(id: Int) async throws {
        let _: OKResponse = try await client.delete("/api/transactions/\(id)")
    }
}
