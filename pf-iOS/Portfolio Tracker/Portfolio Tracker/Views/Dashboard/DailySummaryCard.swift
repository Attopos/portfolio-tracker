import SwiftUI

struct DailySummaryCard: View {
    let summary: DailySummary
    let totalCNY: Double

    private var isPositive: Bool { summary.dailyPnlCny >= 0 }
    private var pnlColor: Color { isPositive ? .green : .red }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Portfolio Value")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(Formatters.cny(totalCNY))
                .font(.system(size: 38, weight: .bold, design: .rounded))

            HStack(spacing: 6) {
                Image(systemName: isPositive ? "arrow.up.right" : "arrow.down.right")
                    .font(.subheadline.bold())
                Text(Formatters.cny(abs(summary.dailyPnlCny)))
                    .font(.subheadline.bold())
                Text("(\(Formatters.percent(summary.dailyPnlPct)))")
                    .font(.subheadline)
                Text("24h")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .foregroundStyle(pnlColor)
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }
}
