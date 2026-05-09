import Foundation

/// Authenticated user as returned by GET /api/me and POST /api/auth/google.
/// Fields are snake_case in the JSON response (direct DB row from the users table).
struct User: Codable, Identifiable, Hashable {
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
}

// MARK: - Response envelopes

struct UserResponse: Decodable {
    let ok: Bool
    let user: User
}
