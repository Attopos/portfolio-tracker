import Foundation

struct AuthService {
    private let client: APIClient

    nonisolated init(client: APIClient = .shared) {
        self.client = client
    }

    func currentUser() async throws -> User {
        let response: UserResponse = try await client.get("/api/me")
        return response.user
    }

    func signIn(googleCredential: String) async throws -> User {
        let response: UserResponse = try await client.post(
            "/api/auth/google",
            body: GoogleSignInBody(credential: googleCredential)
        )
        return response.user
    }

    func signOut() async throws {
        let _: OKResponse = try await client.post("/api/auth/logout", body: EmptyBody())
    }
}

private struct GoogleSignInBody: Encodable {
    let credential: String
}

private struct EmptyBody: Encodable {}
