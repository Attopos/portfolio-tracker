import SwiftUI

struct DashboardView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(PortfolioViewModel.self) private var portfolio

    private var totalInvestedCNY: Double {
        PortfolioMetrics.totalInvestedCNY(
            positions: portfolio.positions,
            marketPrices: portfolio.marketPrices,
            fxRate: portfolio.fxRate
        )
    }

    private var totalProfitCNY: Double {
        portfolio.totalValueCNY - totalInvestedCNY
    }

    private var totalProfitPercent: Double {
        totalInvestedCNY > 0 ? (totalProfitCNY / totalInvestedCNY) * 100 : 0
    }

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
                    } else if let summary = portfolio.dailySummary {
                        LazyVGrid(columns: summaryColumns, spacing: 14) {
                            DailySummaryCard(summary: summary, totalCNY: portfolio.totalValueCNY)
                            PTMetricCard(
                                label: "Total Profit",
                                systemImage: "arrow.up.right",
                                value: "\(totalProfitCNY >= 0 ? "+" : "-")\(Formatters.cny(abs(totalProfitCNY)))",
                                footer: Formatters.percent(totalProfitPercent),
                                valueColor: totalProfitCNY >= 0 ? PTTheme.accent : PTTheme.negative
                            )
                        }
                    } else {
                        ProgressView()
                            .tint(PTTheme.accent)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 30)
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
                .padding(18)
            }
            .portfolioScreenBackground()
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .refreshable {
                await portfolio.loadAll()
                await portfolio.loadHistory()
            }
        }
    }

    private var summaryColumns: [GridItem] {
        horizontalSizeClass == .compact
            ? [GridItem(.flexible(), spacing: 14)]
            : [GridItem(.flexible(), spacing: 14), GridItem(.flexible(), spacing: 14)]
    }
}
