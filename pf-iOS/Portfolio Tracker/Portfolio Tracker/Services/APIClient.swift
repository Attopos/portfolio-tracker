import Foundation

// MARK: - Base URL configuration

private enum APIConfig {
    static let baseURL = URL(string: "https://portfolio-tracker.app")!
}

// MARK: - Error type

enum APIError: LocalizedError {
    case http(statusCode: Int, serverMessage: String?)
    case unauthorized
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .http(let code, let message):
            return message ?? "Server error (\(code))"
        case .unauthorized:
            return "Not signed in"
        case .decoding(let error):
            return "Unexpected response format: \(error.localizedDescription)"
        case .network(let error):
            return error.localizedDescription
        }
    }
}

// MARK: - Client

/// Thin URLSession wrapper. Cookie handling (portfolio.sid) is automatic via the
/// default session configuration. Marked @unchecked Sendable because all stored
/// properties are either immutable or thread-safe (URLSession, JSONDecoder/Encoder).
final class APIClient: @unchecked Sendable {

    nonisolated(unsafe) static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        session = URLSession(configuration: .default)

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom(decodeISO8601Date)

        encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
    }

    // MARK: Public interface

    func get<T: Decodable>(_ path: String) async throws -> T {
        let req = try buildRequest(method: "GET", path: path)
        return try await send(req)
    }

    func post<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        var req = try buildRequest(method: "POST", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await send(req)
    }

    func put<T: Decodable>(_ path: String, body: some Encodable) async throws -> T {
        var req = try buildRequest(method: "PUT", path: path)
        req.httpBody = try encoder.encode(body)
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        return try await send(req)
    }

    @discardableResult
    func delete<T: Decodable>(_ path: String) async throws -> T {
        let req = try buildRequest(method: "DELETE", path: path)
        return try await send(req)
    }

    // MARK: Private

    private func buildRequest(method: String, path: String) throws -> URLRequest {
        guard let url = URL(string: path, relativeTo: APIConfig.baseURL)?.absoluteURL else {
            throw URLError(.badURL)
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        return req
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw APIError.network(URLError(.badServerResponse))
        }

        if http.statusCode == 401 { throw APIError.unauthorized }

        guard (200..<300).contains(http.statusCode) else {
            let message = (try? JSONDecoder().decode(ServerErrorBody.self, from: data))?.error
            throw APIError.http(statusCode: http.statusCode, serverMessage: message)
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

// MARK: - ISO8601 date decoding
//
// PostgreSQL TIMESTAMPTZ arrives as "2024-01-01T00:00:00.123Z" (with milliseconds).
// Swift's built-in .iso8601 strategy rejects fractional seconds, so we create
// formatters inline per call — acceptable cost for a network-bound decode path.

private func decodeISO8601Date(from decoder: Decoder) throws -> Date {
    let container = try decoder.singleValueContainer()
    let string = try container.decode(String.self)

    let withFractional = ISO8601DateFormatter()
    withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = withFractional.date(from: string) { return date }

    let plain = ISO8601DateFormatter()
    plain.formatOptions = [.withInternetDateTime]
    if let date = plain.date(from: string) { return date }

    throw DecodingError.dataCorruptedError(
        in: container,
        debugDescription: "Cannot parse date: \(string)"
    )
}

// MARK: - Internal helper

private struct ServerErrorBody: Decodable {
    let error: String?
}
