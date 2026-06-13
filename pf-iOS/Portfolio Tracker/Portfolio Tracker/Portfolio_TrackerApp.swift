import SwiftUI
import GoogleSignIn

@main
struct Portfolio_TrackerApp: App {
    @State private var auth = AuthViewModel()
    @State private var portfolio = PortfolioViewModel()

    init() {
        guard
            let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
            let serverClientID = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID") as? String
        else {
            return
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(
            clientID: clientID,
            serverClientID: serverClientID
        )
    }

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
