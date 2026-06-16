import SwiftUI

struct AssetDetailView: View {
    let position: Position

    @Environment(PortfolioViewModel.self) private var portfolio
    @Environment(\.dismiss) private var dismiss

    @State private var manualPriceText = ""
    @State private var isSaving = false
    @State private var saveError: String?
    @State private var showDeleteConfirm = false

    private var current: Position {
        portfolio.positions.first { $0.id == position.id } ?? position
    }

    private var metrics: PositionMetrics {
        PortfolioMetrics.metrics(for: current, marketPrices: portfolio.marketPrices, fxRate: portfolio.fxRate)
    }

    private var assetTransactions: [Transaction] {
        portfolio.transactions.filter { $0.assetId == position.id }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PTPageHeader(eyebrow: current.currency.rawValue, title: current.name)

                VStack(spacing: 12) {
                    detailLine("Quantity", Formatters.quantity(current.position))
                    detailLine("Currency", current.currency.rawValue)
                    detailLine("Value (CNY)", Formatters.cny(metrics.valueCNY))
                    detailLine("Value (USD)", Formatters.usd(metrics.valueUSD))
                    detailLine("Effective Price", Formatters.value(metrics.effectivePrice, currency: current.currency))
                }
                .portfolioCard()

                VStack(alignment: .leading, spacing: 14) {
                    Text("Price Override")
                        .font(.headline)
                        .foregroundStyle(PTTheme.textStrong)

                    TextField("e.g. 50000", text: $manualPriceText)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(.plain)
                        .padding(13)
                        .background(PTTheme.surface2)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                        .foregroundStyle(PTTheme.text)

                    HStack(spacing: 12) {
                        Button("Save") { Task { await saveManualPrice() } }
                            .buttonStyle(PTAccentButtonStyle())
                            .disabled(isSaving || manualPriceText.isEmpty)

                        if current.manualMarketPrice != nil {
                            Button("Clear") { Task { await clearManualPrice() } }
                                .foregroundStyle(PTTheme.negative)
                                .disabled(isSaving)
                        }

                        if isSaving {
                            ProgressView()
                                .tint(PTTheme.accent)
                        }
                    }

                    if let saveError {
                        Text(saveError)
                            .font(.caption)
                            .foregroundStyle(PTTheme.negative)
                    }
                }
                .portfolioCard()

                VStack(alignment: .leading, spacing: 12) {
                    Text("Recent Transactions")
                        .font(.headline)
                        .foregroundStyle(PTTheme.textStrong)

                    if assetTransactions.isEmpty {
                        Text("No transactions recorded.")
                            .font(.subheadline)
                            .foregroundStyle(PTTheme.textMuted)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                    } else {
                        ForEach(assetTransactions) { txn in
                            TransactionRow(transaction: txn)
                        }
                    }
                }

                Button("Delete Holding", role: .destructive) {
                    showDeleteConfirm = true
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(PTTheme.negative.opacity(0.14))
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .padding(18)
        }
        .portfolioScreenBackground()
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            manualPriceText = current.manualMarketPrice.map { String($0) } ?? ""
        }
        .confirmationDialog(
            "Delete \(current.name)?",
            isPresented: $showDeleteConfirm,
            titleVisibility: .visible
        ) {
            Button("Delete Holding and All Transactions", role: .destructive) {
                Task {
                    try? await portfolio.deletePosition(assetId: current.id)
                    dismiss()
                }
            }
        } message: {
            Text("All associated transactions will also be removed. This cannot be undone.")
        }
    }

    private func detailLine(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
                .foregroundStyle(PTTheme.textMuted)
            Spacer()
            Text(value)
                .foregroundStyle(PTTheme.textStrong)
                .monospacedDigit()
        }
        .font(.subheadline)
    }

    private func saveManualPrice() async {
        guard let value = Double(manualPriceText.trimmingCharacters(in: .whitespaces)) else { return }
        isSaving = true
        saveError = nil
        defer { isSaving = false }
        do {
            try await portfolio.updatePosition(assetId: current.id, manualMarketPrice: value)
        } catch {
            saveError = error.localizedDescription
        }
    }

    private func clearManualPrice() async {
        isSaving = true
        saveError = nil
        manualPriceText = ""
        defer { isSaving = false }
        do {
            try await portfolio.updatePosition(assetId: current.id, clearManualPrice: true)
        } catch {
            saveError = error.localizedDescription
        }
    }
}
