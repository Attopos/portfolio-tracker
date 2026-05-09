import Foundation

struct MarketDataService {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    /// Fetches live prices for the given asset symbols (e.g. ["BTC", "ETH"]).
    /// The server normalises symbols and silently ignores unrecognised ones.
    func fetchPrices(for symbols: [String]) async throws -> [String: MarketPrice] {
        guard !symbols.isEmpty else { return [:] }
        let query = symbols
            .joined(separator: ",")
            .addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let response: MarketPricesResponse = try await client.get("/api/market-prices?assets=\(query)")
        return response.prices
    }

    func fetchFXRate() async throws -> FXRateResponse {
        return try await client.get("/api/fx-rate")
    }
}
