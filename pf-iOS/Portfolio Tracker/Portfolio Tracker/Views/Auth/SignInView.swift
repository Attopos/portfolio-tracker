import SwiftUI
// import GoogleSignIn  // Uncomment after: File → Add Package → https://github.com/google/GoogleSignIn-iOS

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
            let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
            let root = windowScene.windows.first?.rootViewController
        else { return }

        // ── After installing the GoogleSignIn package ──────────────────────────
        // 1. Uncomment `import GoogleSignIn` at the top of this file.
        // 2. Add GIDClientID (your OAuth client ID) to Info.plist.
        // 3. Add the reversed client ID as a URL Scheme in Info.plist.
        // 4. Replace this comment block with:
        //
        // GIDSignIn.sharedInstance.signIn(withPresenting: root) { result, error in
        //     guard error == nil,
        //           let user = result?.user,
        //           let idToken = user.idToken?.tokenString else { return }
        //     Task { await auth.signIn(googleCredential: idToken) }
        // }
        // ──────────────────────────────────────────────────────────────────────

        _ = root  // suppress unused-variable warning until SDK is wired up
    }
}
