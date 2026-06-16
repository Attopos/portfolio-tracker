import SwiftUI
import Charts

struct AllocationChartView: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let positions: [Position]
    let marketPrices: [String: MarketPrice]
    let fxRate: Double

    struct AllocationItem: Identifiable {
        let position: Position
        let metrics: PositionMetrics
        let color: Color

        var id: String { position.id }
        var allocation: Double
    }

    private var items: [AllocationItem] {
        let ranked = positions
            .map { position in
                (position, PortfolioMetrics.metrics(for: position, marketPrices: marketPrices, fxRate: fxRate))
            }
            .filter { $0.1.valueCNY > 0 }
            .sorted { $0.1.valueCNY > $1.1.valueCNY }

        let total = ranked.reduce(0) { $0 + $1.1.valueCNY }

        return ranked.enumerated().map { index, pair in
            AllocationItem(
                position: pair.0,
                metrics: pair.1,
                color: PTTheme.chartColors[index % PTTheme.chartColors.count],
                allocation: total > 0 ? (pair.1.valueCNY / total) * 100 : 0
            )
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            if items.isEmpty {
                PTEmptyState(
                    title: "No allocation data",
                    message: "Add a transaction to populate your asset mix.",
                    systemImage: "chart.pie"
                )
            } else {
                content
                .portfolioCard(padding: 18)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if horizontalSizeClass == .compact {
            VStack(spacing: 18) {
                donut
                    .frame(maxWidth: .infinity, alignment: .center)
                rows
            }
        } else {
            HStack(alignment: .top, spacing: 18) {
                donut
                rows
            }
        }
    }

    private var donut: some View {
        Chart(items) { item in
            SectorMark(
                angle: .value("Value", item.metrics.valueCNY),
                innerRadius: .ratio(0.58),
                angularInset: 1.5
            )
            .foregroundStyle(item.color)
            .cornerRadius(4)
        }
        .chartLegend(.hidden)
        .frame(width: 150, height: 150)
    }

    private var rows: some View {
        VStack(spacing: 0) {
            ForEach(items) { item in
                AllocationRow(item: item)
                if item.id != items.last?.id {
                    Divider()
                        .background(PTTheme.line)
                }
            }
        }
        .frame(maxWidth: .infinity)
    }
}

private struct AllocationRow: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let item: AllocationChartView.AllocationItem

    var body: some View {
        if horizontalSizeClass == .compact {
            VStack(alignment: .leading, spacing: 10) {
                identity
                metrics
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 12)
        } else {
            HStack(spacing: 12) {
                identity
                Spacer(minLength: 8)
                metrics
            }
            .padding(.vertical, 10)
        }
    }

    private var identity: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 3)
                .fill(item.color)
                .frame(width: 5, height: 38)

            PTAssetBadge(symbol: item.position.id)

            VStack(alignment: .leading, spacing: 4) {
                Text(item.position.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(PTTheme.textStrong)
                    .lineLimit(1)
                Text("\(Formatters.quantity(item.position.position)) \(item.position.currency.rawValue)")
                    .font(.caption)
                    .foregroundStyle(PTTheme.textMuted)
            }
        }
    }

    private var metrics: some View {
        VStack(alignment: horizontalSizeClass == .compact ? .leading : .trailing, spacing: 4) {
            Text(Formatters.cny(item.metrics.valueCNY))
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(PTTheme.textStrong)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.78)
            Text("\(String(format: "%.2f", item.allocation))%")
                .font(.caption)
                .foregroundStyle(PTTheme.textMuted)
                .monospacedDigit()
        }
    }
}
