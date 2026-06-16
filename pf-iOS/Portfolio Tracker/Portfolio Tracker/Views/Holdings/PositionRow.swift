import SwiftUI

struct PositionRow: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let position: Position
    let marketPrices: [String: MarketPrice]
    let fxRate: Double

    private var metrics: PositionMetrics {
        PortfolioMetrics.metrics(for: position, marketPrices: marketPrices, fxRate: fxRate)
    }

    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                VStack(alignment: .leading, spacing: 12) {
                    identity
                    values
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                HStack(spacing: 14) {
                    identity
                    Spacer(minLength: 8)
                    values
                }
            }
        }
        .padding(16)
        .background(PTTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var identity: some View {
        HStack(spacing: 14) {
            PTAssetBadge(symbol: position.id)

            VStack(alignment: .leading, spacing: 5) {
                Text(position.name)
                    .font(.headline)
                    .foregroundStyle(PTTheme.textStrong)
                    .lineLimit(1)
                Text("\(Formatters.quantity(position.position)) \(position.currency.rawValue)")
                    .font(.subheadline)
                    .foregroundStyle(PTTheme.textMuted)
            }
        }
    }

    private var values: some View {
        VStack(alignment: horizontalSizeClass == .compact ? .leading : .trailing, spacing: 5) {
            Text(Formatters.cny(metrics.valueCNY))
                .font(.headline)
                .foregroundStyle(PTTheme.textStrong)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.72)
            Text("\(metrics.gainCNY >= 0 ? "+" : "-")\(Formatters.cny(abs(metrics.gainCNY)))")
                .font(.caption.weight(.semibold))
                .foregroundStyle(metrics.gainCNY >= 0 ? PTTheme.accent : PTTheme.negative)
                .monospacedDigit()
        }
    }
}
