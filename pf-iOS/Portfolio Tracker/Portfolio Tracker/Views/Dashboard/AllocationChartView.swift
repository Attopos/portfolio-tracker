import SwiftUI
import Charts

struct AllocationChartView: View {
    let positions: [Position]
    let marketPrices: [String: MarketPrice]
    let fxRate: Double

    private struct Slice: Identifiable {
        let id: String
        let name: String
        let valueCNY: Double
    }

    private var slices: [Slice] {
        positions
            .map { p in
                let m = PortfolioMetrics.metrics(for: p, marketPrices: marketPrices, fxRate: fxRate)
                return Slice(id: p.id, name: p.name, valueCNY: m.valueCNY)
            }
            .filter { $0.valueCNY > 0 }
            .sorted { $0.valueCNY > $1.valueCNY }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Allocation")
                .font(.headline)
                .padding(.horizontal)

            if slices.isEmpty {
                Text("No holdings to display.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding()
            } else {
                Chart(slices) { slice in
                    SectorMark(
                        angle: .value("Value", slice.valueCNY),
                        innerRadius: .ratio(0.55),
                        angularInset: 2
                    )
                    .foregroundStyle(by: .value("Asset", slice.name))
                    .cornerRadius(4)
                }
                .frame(height: 200)
                .padding(.horizontal)

                VStack(spacing: 6) {
                    ForEach(slices) { slice in
                        HStack {
                            Text(slice.name)
                                .font(.subheadline)
                            Spacer()
                            Text(Formatters.cny(slice.valueCNY))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.bottom, 4)
            }
        }
    }
}
