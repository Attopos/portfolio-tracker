import SwiftUI
import GoogleSignIn

struct SignInView: View {
    @Environment(AuthViewModel.self) private var auth

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            VStack(spacing: 12) {
                Image(systemName: "chart.pie.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.blue)
                Text("Portfolio Tracker")
                    .font(.largeTitle.bold())
            }

            Spacer()

            if auth.isLoading {
                ProgressView("Signing in...")
            } else {
                Button(action: handleSignIn) {
                    HStack(spacing: 10) {
                        Image(systemName: "person.crop.circle.fill")
                        Text("Sign in with Google")
                            .fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color(.systemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.06), radius: 6, y: 2)
                }
                .padding(.horizontal, 32)
            }

            if let error = auth.authError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            Spacer()
        }
        .padding()
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
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
