import SwiftUI

struct PositionRow: View {
    let position: Position
    let marketPrices: [String: MarketPrice]
    let fxRate: Double

    private var metrics: PositionMetrics {
        PortfolioMetrics.metrics(for: position, marketPrices: marketPrices, fxRate: fxRate)
    }

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(position.name)
                    .font(.headline)
                Text(Formatters.quantity(position.position) + " \(position.currency.rawValue)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 4) {
                Text(Formatters.cny(metrics.valueCNY))
                    .font(.headline)
                Text(Formatters.value(metrics.effectivePrice, currency: position.currency) + " / unit")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
