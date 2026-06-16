import SwiftUI
import Charts

struct HistoryChartView: View {
    @Environment(PortfolioViewModel.self) private var portfolio

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("History")
                    .font(.headline)
                    .foregroundStyle(PTTheme.textStrong)
                Spacer()
                // @Bindable wrapper lets us bind to an @Observable from @Environment
                let vm = Bindable(portfolio)
                Picker("Range", selection: vm.selectedRange) {
                    ForEach(HistoryRange.allCases) { range in
                        Text(range.label).tag(range)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
                .tint(PTTheme.accent)
            }

            if portfolio.historyPoints.isEmpty {
                Text("No history data yet.")
                    .foregroundStyle(PTTheme.textMuted)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 28)
            } else {
                Chart(portfolio.historyPoints) { point in
                    LineMark(
                        x: .value("Date", point.capturedAt),
                        y: .value("USD", point.totalUsd)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(PTTheme.accent)

                    AreaMark(
                        x: .value("Date", point.capturedAt),
                        y: .value("USD", point.totalUsd)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(PTTheme.accent.opacity(0.12))
                }
                .chartXAxis {
                    AxisMarks(values: .automatic(desiredCount: 4)) {
                        AxisGridLine().foregroundStyle(PTTheme.line)
                        AxisValueLabel().foregroundStyle(PTTheme.textMuted)
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) {
                        AxisGridLine().foregroundStyle(PTTheme.line)
                        AxisValueLabel().foregroundStyle(PTTheme.textMuted)
                    }
                }
                .frame(height: 160)
            }
        }
        .portfolioCard(padding: 18)
        .onChange(of: portfolio.selectedRange) { _, _ in
            Task { await portfolio.loadHistory() }
        }
    }
}
