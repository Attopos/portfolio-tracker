import Foundation

struct PortfolioHistoryService {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func fetchHistory(range: HistoryRange = .thirtyDays) async throws -> [HistoryPoint] {
        let response: PortfolioHistoryResponse = try await client.get(
            "/api/portfolio-history?range=\(range.rawValue)"
        )
        return response.points
    }

    func fetchDailySummary() async throws -> DailySummary {
        let response: DailySummaryResponse = try await client.get("/api/portfolio-history/summary")
        return response.summary
    }
}
