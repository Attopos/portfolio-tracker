import Foundation

/// Authenticated user as returned by GET /api/me and POST /api/auth/google.
/// Fields are snake_case in the JSON response (direct DB row from the users table).
struct User: Decodable, Identifiable, Hashable {
    let id: Int
    let googleSub: String
    let email: String?
    let name: String?
    let avatarURL: String?
    let createdAt: Date
    let updatedAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case googleSub   = "google_sub"
        case email
        case name
        case avatarURL   = "avatar_url"
        case createdAt   = "created_at"
        case updatedAt   = "updated_at"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        if let intID = try? container.decode(Int.self, forKey: .id) {
            id = intID
        } else {
            let stringID = try container.decode(String.self, forKey: .id)
            guard let intID = Int(stringID) else {
                throw DecodingError.dataCorruptedError(
                    forKey: .id,
                    in: container,
                    debugDescription: "Expected a numeric user id."
                )
            }
            id = intID
        }

        googleSub = try container.decode(String.self, forKey: .googleSub)
        email = try container.decodeIfPresent(String.self, forKey: .email)
        name = try container.decodeIfPresent(String.self, forKey: .name)
        avatarURL = try container.decodeIfPresent(String.self, forKey: .avatarURL)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
    }
}

// MARK: - Response envelopes

struct UserResponse: Decodable {
    let ok: Bool
    let user: User
}
