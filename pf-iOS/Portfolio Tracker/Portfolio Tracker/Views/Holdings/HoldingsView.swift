import SwiftUI

struct HoldingsView: View {
    @Environment(PortfolioViewModel.self) private var portfolio

    private var totalCNY: Double { portfolio.totalValueCNY }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    PTPageHeader(
                        eyebrow: "Portfolio",
                        title: "Holdings",
                        trailing: AnyView(
                            Text("\(portfolio.positions.count) assets")
                                .font(.caption.weight(.bold))
                                .foregroundStyle(PTTheme.accent)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(PTTheme.accentSoft)
                                .clipShape(Capsule())
                        )
                    )

                    PTMetricCard(
                        label: "Total Value",
                        systemImage: "chart.pie",
                        value: Formatters.cny(totalCNY),
                        footer: "\(Formatters.usd(portfolio.totalValueUSD)) · FX \(String(format: "%.2f", portfolio.fxRate))"
                    )

                    content
                }
                .padding(18)
            }
            .portfolioScreenBackground()
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: Position.self) { position in
                AssetDetailView(position: position)
            }
            .refreshable {
                await portfolio.loadPositions()
                await portfolio.loadMarketData()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if portfolio.isPositionsLoading && portfolio.positions.isEmpty {
            LoadingView()
                .frame(minHeight: 260)
        } else if let error = portfolio.positionsError, portfolio.positions.isEmpty {
            ErrorBanner(message: error)
        } else if portfolio.positions.isEmpty {
            PTEmptyState(
                title: "No Holdings",
                message: "Add a transaction to start tracking your portfolio.",
                systemImage: "chart.pie"
            )
        } else {
            VStack(spacing: 10) {
                ForEach(portfolio.positions) { position in
                    NavigationLink(value: position) {
                        PositionRow(
                            position: position,
                            marketPrices: portfolio.marketPrices,
                            fxRate: portfolio.fxRate
                        )
                    }
                    .buttonStyle(.plain)
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button(role: .destructive) {
                            Task { try? await portfolio.deletePosition(assetId: position.id) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
        }
    }
}
