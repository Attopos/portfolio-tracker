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

    var body: some View {
        List {
            Section("Position") {
                LabeledContent("Asset", value: current.name)
                LabeledContent("Quantity", value: Formatters.quantity(current.position))
                LabeledContent("Currency", value: current.currency.rawValue)
            }

            Section("Valuation") {
                LabeledContent("Value (CNY)", value: Formatters.cny(metrics.valueCNY))
                LabeledContent("Value (USD)", value: Formatters.usd(metrics.valueUSD))
                LabeledContent(
                    "Effective Price",
                    value: Formatters.value(metrics.effectivePrice, currency: current.currency)
                )
                if current.manualMarketPrice != nil {
                    Label("Manual price override is active", systemImage: "pencil.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }

            Section {
                HStack {
                    Text("Override Price")
                    Spacer()
                    TextField("e.g. 50000", text: $manualPriceText)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(maxWidth: 160)
                }

                HStack(spacing: 16) {
                    Button("Save") { Task { await saveManualPrice() } }
                        .disabled(isSaving || manualPriceText.isEmpty)

                    if current.manualMarketPrice != nil {
                        Button("Clear Override", role: .destructive) {
                            Task { await clearManualPrice() }
                        }
                        .disabled(isSaving)
                    }
                }

                if isSaving { ProgressView() }
                if let err = saveError {
                    Text(err).font(.caption).foregroundStyle(.red)
                }
            } header: {
                Text("Price Override")
            } footer: {
                Text("Overrides live market price for this holding only.")
            }

            Section("Recent Transactions") {
                let assetTxns = portfolio.transactions.filter { $0.assetId == position.id }
                if assetTxns.isEmpty {
                    Text("No transactions recorded.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(assetTxns) { txn in
                        TransactionRow(transaction: txn)
                    }
                }
            }

            Section {
                Button("Delete Holding", role: .destructive) {
                    showDeleteConfirm = true
                }
            }
        }
        .navigationTitle(current.name)
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
