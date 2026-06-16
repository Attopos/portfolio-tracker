import SwiftUI
import GoogleSignIn

struct SignInView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            VStack(spacing: 18) {
                Image(systemName: "chart.pie.fill")
                    .font(.system(size: 58))
                    .foregroundStyle(PTTheme.accent)
                Text("Portfolio Tracker")
                    .font(.system(size: 34, weight: .semibold, design: .rounded))
                    .foregroundStyle(PTTheme.textStrong)
                Text("Sign in to sync your positions, market prices, and transaction ledger.")
                    .font(.subheadline)
                    .foregroundStyle(PTTheme.textMuted)
                    .multilineTextAlignment(.center)
            }
            .portfolioCard(padding: 28)
            .padding(.horizontal, 22)

            Spacer()

            if auth.isLoading {
                ProgressView("Signing in...")
                    .tint(PTTheme.accent)
                    .foregroundStyle(PTTheme.text)
            } else {
                Button(action: handleSignIn) {
                    HStack(spacing: 10) {
                        Image(systemName: "person.crop.circle.fill")
                        Text("Sign in with Google")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                }
                .buttonStyle(PTAccentButtonStyle())
                .padding(.horizontal, 32)
            }

            if let error = auth.authError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(PTTheme.negative)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Spacer()
        }
        .padding()
        .background(PTTheme.canvas.ignoresSafeArea())
    }

    private func handleSignIn() {
        guard
            let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
            !clientID.isEmpty,
            let serverClientID = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String,
            !serverClientID.isEmpty
        else {
            auth.reportSignInError("Google sign-in is not configured correctly.")
            return
        }

        guard
            let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
            let root = windowScene.keyWindow?.rootViewController
        else {
            auth.reportSignInError("Unable to open Google sign-in.")
            return
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: clientID,
            serverClientID: serverClientID
        )
        GIDSignIn.sharedInstance.signIn(withPresenting: root) { result, error in
            if let error {
                Task { @MainActor in auth.reportSignInError(error) }
                return
            }

            guard let idToken = result?.user.idToken?.tokenString else {
                Task { @MainActor in
                    auth.reportSignInError("Google did not return an identity token.")
                }
                return
            }

            Task {
                await auth.signIn(googleCredential: idToken)
            }
        }
    }
}
