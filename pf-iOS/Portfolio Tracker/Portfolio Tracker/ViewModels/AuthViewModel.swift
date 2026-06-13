import Foundation
import GoogleSignIn
import Observation

@Observable
@MainActor
final class AuthViewModel {
    var user: User?
    var isLoading = false
    var authError: String?

    var isAuthenticated: Bool { user != nil }

    private let service: AuthService

    init(service: AuthService = AuthService()) {
        self.service = service
    }

    /// Called once at app launch to restore an existing server session via the stored cookie.
    func restoreSession() async {
        isLoading = true
        defer { isLoading = false }
        do {
            user = try await service.currentUser()
        } catch {
            user = nil  // 401 or network failure — stay on sign-in screen
        }
    }

    func signIn(googleCredential: String) async {
        isLoading = true
        authError = nil
        defer { isLoading = false }
        do {
            user = try await service.signIn(googleCredential: googleCredential)
        } catch {
            authError = error.localizedDescription
        }
    }

    func reportSignInError(_ error: Error) {
        authError = error.localizedDescription
    }

    func reportSignInError(_ message: String) {
        authError = message
    }

    func signOut() async {
        try? await service.signOut()
        GIDSignIn.sharedInstance.signOut()
        user = nil
        authError = nil
    }
}
