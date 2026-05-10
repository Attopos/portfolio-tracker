import SwiftUI
import GoogleSignIn

@main
struct Portfolio_TrackerApp: App {
    @State private var auth = AuthViewModel()
    @State private var portfolio = PortfolioViewModel()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(auth)
                .environment(portfolio)
                .task { await auth.restoreSession() }
                .onOpenURL { url in
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}
