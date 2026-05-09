import SwiftUI

struct DashboardView: View {
    @Environment(PortfolioViewModel.self) private var portfolio

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    if let summary = portfolio.dailySummary {
                        DailySummaryCard(summary: summary, totalCNY: portfolio.totalValueCNY)
                    } else if portfolio.positions.isEmpty {
                        ContentUnavailableView(
                            "No Holdings Yet",
                            systemImage: "chart.pie.fill",
                            description: Text("Go to Transactions to record your first trade.")
                        )
                        .padding(.top, 60)
                    } else {
                        ProgressView()
                            .padding(.top, 40)
                    }

                    if !portfolio.positions.isEmpty {
                        AllocationChartView(
                            positions: portfolio.positions,
                            marketPrices: portfolio.marketPrices,
                            fxRate: portfolio.fxRate
                        )

                        HistoryChartView()
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Dashboard")
            .refreshable {
                await portfolio.loadAll()
                await portfolio.loadHistory()
            }
        }
    }
}
