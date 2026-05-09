import SwiftUI

// MARK: - Root routing view

struct ContentView: View {
    @Environment(AuthViewModel.self) private var auth
    @Environment(PortfolioViewModel.self) private var portfolio

    var body: some View {
        Group {
            if auth.isLoading {
                LoadingView(message: "Restoring session…")
            } else if auth.isAuthenticated {
                MainTabView()
                    .task { await portfolio.loadAll() }
                    .task { await portfolio.loadHistory() }
            } else {
                SignInView()
            }
        }
        .animation(.easeInOut(duration: 0.2), value: auth.isAuthenticated)
    }
}

// MARK: - Main navigation

struct MainTabView: View {
    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "chart.pie.fill") }

            HoldingsView()
                .tabItem { Label("Holdings", systemImage: "list.bullet") }

            TransactionsView()
                .tabItem { Label("Transactions", systemImage: "arrow.left.arrow.right.circle") }
        }
    }
}
