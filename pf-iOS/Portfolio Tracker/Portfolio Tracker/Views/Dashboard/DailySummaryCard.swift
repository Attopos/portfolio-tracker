import SwiftUI

struct DailySummaryCard: View {
    let summary: DailySummary
    let totalCNY: Double

    private var isPositive: Bool { summary.dailyPnlCny >= 0 }
    private var pnlColor: Color { isPositive ? PTTheme.accent : PTTheme.negative }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: "wallet.pass")
                    .foregroundStyle(PTTheme.accent)
                Text("Value")
                    .font(.subheadline)
                    .foregroundStyle(PTTheme.textSoft)
            }

            Text(Formatters.cny(totalCNY))
                .font(.system(size: 30, weight: .medium, design: .rounded))
                .foregroundStyle(PTTheme.textStrong)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.7)

            HStack(spacing: 6) {
                Image(systemName: isPositive ? "arrow.up.right" : "arrow.down.right")
                    .font(.subheadline.bold())
                Text(Formatters.cny(abs(summary.dailyPnlCny)))
                    .font(.subheadline.bold())
                Text("(\(Formatters.percent(summary.dailyPnlPct)))")
                    .font(.subheadline)
                Text("24h")
                    .font(.caption)
                    .foregroundStyle(PTTheme.textMuted)
            }
            .foregroundStyle(pnlColor)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .portfolioCard(padding: 20)
    }
}
