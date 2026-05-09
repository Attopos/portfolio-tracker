import SwiftUI

struct HoldingsView: View {
    @Environment(PortfolioViewModel.self) private var portfolio

    var body: some View {
        NavigationStack {
            Group {
                if portfolio.isPositionsLoading && portfolio.positions.isEmpty {
                    LoadingView()
                } else if let error = portfolio.positionsError, portfolio.positions.isEmpty {
                    ErrorBanner(message: error)
                } else if portfolio.positions.isEmpty {
                    ContentUnavailableView(
                        "No Holdings",
                        systemImage: "chart.pie",
                        description: Text("Add a transaction to start tracking your portfolio.")
                    )
                } else {
                    List {
                        ForEach(portfolio.positions) { position in
                            NavigationLink(value: position) {
                                PositionRow(
                                    position: position,
                                    marketPrices: portfolio.marketPrices,
                                    fxRate: portfolio.fxRate
                                )
                            }
                        }
                        .onDelete { offsets in
                            let ids = offsets.map { portfolio.positions[$0].id }
                            Task {
                                for id in ids {
                                    try? await portfolio.deletePosition(assetId: id)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Holdings")
            .navigationDestination(for: Position.self) { position in
                AssetDetailView(position: position)
            }
            .refreshable {
                await portfolio.loadPositions()
                await portfolio.loadMarketData()
            }
            .toolbar {
                if portfolio.isPositionsLoading {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
            }
        }
    }
}
