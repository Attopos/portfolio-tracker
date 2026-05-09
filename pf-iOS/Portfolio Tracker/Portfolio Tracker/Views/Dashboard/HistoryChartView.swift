import SwiftUI
import Charts

struct HistoryChartView: View {
    @Environment(PortfolioViewModel.self) private var portfolio

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("History")
                    .font(.headline)
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
            }
            .padding(.horizontal)

            if portfolio.historyPoints.isEmpty {
                Text("No history data yet.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                Chart(portfolio.historyPoints) { point in
                    LineMark(
                        x: .value("Date", point.capturedAt),
                        y: .value("USD", point.totalUsd)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(.blue)

                    AreaMark(
                        x: .value("Date", point.capturedAt),
                        y: .value("USD", point.totalUsd)
                    )
                    .interpolationMethod(.catmullRom)
                    .foregroundStyle(.blue.opacity(0.12))
                }
                .frame(height: 160)
                .padding(.horizontal)
            }
        }
        .onChange(of: portfolio.selectedRange) { _, _ in
            Task { await portfolio.loadHistory() }
        }
    }
}
