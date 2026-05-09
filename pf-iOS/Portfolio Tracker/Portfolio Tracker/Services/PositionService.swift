import Foundation

struct PositionService {
    private let client: APIClient

    init(client: APIClient = .shared) {
        self.client = client
    }

    func fetchAll() async throws -> [Position] {
        let response: PositionsResponse = try await client.get("/api/positions")
        return response.positions
    }

    func update(
        assetId: String,
        position: Double? = nil,
        manualMarketPrice: Double? = nil,
        clearManualPrice: Bool = false
    ) async throws -> Position {
        let encoded = assetId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? assetId
        let body = UpdatePositionBody(
            position: position,
            manualMarketPrice: clearManualPrice ? .null : manualMarketPrice.map { .value($0) }
        )
        let response: PositionResponse = try await client.put("/api/positions/\(encoded)", body: body)
        return response.position
    }

    func delete(assetId: String) async throws {
        let encoded = assetId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? assetId
        let _: OKResponse = try await client.delete("/api/positions/\(encoded)")
    }
}

// MARK: - Request body

/// `manualMarketPrice` uses an explicit nullable enum so we can distinguish
/// "omit the key" from "send JSON null" (which clears the override on the server).
private struct UpdatePositionBody: Encodable {
    let position: Double?
    let manualMarketPrice: NullableDouble?

    enum NullableDouble {
        case null
        case value(Double)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encodeIfPresent(position, forKey: .position)
        switch manualMarketPrice {
        case .none:              break                       // omit key entirely
        case .null:              try c.encodeNil(forKey: .manualMarketPrice)
        case .value(let v):      try c.encode(v, forKey: .manualMarketPrice)
        }
    }

    enum CodingKeys: String, CodingKey {
        case position, manualMarketPrice
    }
}
