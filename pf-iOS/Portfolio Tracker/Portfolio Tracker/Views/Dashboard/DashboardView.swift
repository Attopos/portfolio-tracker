import SwiftUI

struct DashboardView: View {
    @Environment(PortfolioViewModel.self) private var portfolio

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    PTPageHeader(eyebrow: "Dashboard", title: "Portfolio overview")

                    if portfolio.positions.isEmpty {
                        PTEmptyState(
                            title: "No Holdings Yet",
                            message: "Go to Transactions to record your first trade.",
                            systemImage: "chart.pie.fill"
                        )
                    } else {
                        PTMetricCard(
                            label: "Value",
                            systemImage: "wallet.pass",
                            value: Formatters.cny(portfolio.totalValueCNY),
                            footer: "\(Formatters.usd(portfolio.totalValueUSD)) · FX \(String(format: "%.2f", portfolio.fxRate))"
                        )
                    }

                    if !portfolio.positions.isEmpty {
                        AllocationChartView(
                            positions: portfolio.positions,
                            marketPrices: portfolio.marketPrices,
                            fxRate: portfolio.fxRate
                        )
                    }
                }
                .padding(18)
            }
            .portfolioScreenBackground()
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable {
                await portfolio.loadAll()
            }
        }
    }
}
