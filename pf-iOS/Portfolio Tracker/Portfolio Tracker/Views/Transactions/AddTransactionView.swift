import SwiftUI

struct AddTransactionView: View {
    @Environment(PortfolioViewModel.self) private var portfolio
    @Environment(\.dismiss) private var dismiss

    @State private var isNewAsset = false
    @State private var selectedPosition: Position?
    @State private var assetName = ""
    @State private var currency: Currency = .usd
    @State private var transactionType: TransactionType = .buy
    @State private var quantityText = ""
    @State private var unitPriceText = ""
    @State private var transactionDate = Date()
    @State private var isSubmitting = false
    @State private var submitError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Asset") {
                    Toggle("New Asset", isOn: $isNewAsset.animation())

                    if isNewAsset {
                        TextField("Asset Name", text: $assetName)
                            .autocorrectionDisabled()
                        Picker("Currency", selection: $currency) {
                            ForEach(Currency.allCases, id: \.self) { c in
                                Text(c.rawValue).tag(c)
                            }
                        }
                    } else {
                        Picker("Holding", selection: $selectedPosition) {
                            Text("Select…").tag(Optional<Position>.none)
                            ForEach(portfolio.positions) { p in
                                Text(p.name).tag(Optional(p))
                            }
                        }
                    }
                }

                Section("Transaction") {
                    Picker("Type", selection: $transactionType) {
                        ForEach(TransactionType.allCases, id: \.self) { t in
                            Text(t.rawValue.capitalized).tag(t)
                        }
                    }
                    .pickerStyle(.segmented)

                    HStack {
                        Text("Quantity")
                        Spacer()
                        TextField("0", text: $quantityText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 140)
                    }

                    HStack {
                        Text("Unit Price")
                        Text("(optional)")
                            .foregroundStyle(.secondary)
                            .font(.footnote)
                        Spacer()
                        TextField("0.00", text: $unitPriceText)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(maxWidth: 140)
                    }

                    DatePicker(
                        "Date",
                        selection: $transactionDate,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }

                if let err = submitError {
                    Section {
                        Text(err).foregroundStyle(.red).font(.footnote)
                    }
                }
            }
            .navigationTitle("Add Transaction")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isSubmitting {
                        ProgressView()
                    } else {
                        Button("Add") { Task { await submit() } }
                            .disabled(!canSubmit)
                    }
                }
            }
        }
    }

    private var canSubmit: Bool {
        guard let qty = Double(quantityText), qty >= 0 else { return false }
        if isNewAsset { return !assetName.trimmingCharacters(in: .whitespaces).isEmpty }
        return selectedPosition != nil
    }

    private func submit() async {
        guard let quantity = Double(quantityText) else { return }
        let unitPrice = Double(unitPriceText.trimmingCharacters(in: .whitespaces))
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        let payload: CreateTransactionPayload

        if isNewAsset {
            let name = assetName.trimmingCharacters(in: .whitespaces)
            guard !name.isEmpty else { return }
            payload = CreateTransactionPayload(
                type: transactionType, assetId: nil, assetName: name,
                currency: currency, quantity: quantity,
                unitPrice: unitPrice, transactedAt: transactionDate
            )
        } else {
            guard let p = selectedPosition else { return }
            payload = CreateTransactionPayload(
                type: transactionType, assetId: p.id, assetName: p.name,
                currency: p.currency, quantity: quantity,
                unitPrice: unitPrice, transactedAt: transactionDate
            )
        }

        do {
            try await portfolio.addTransaction(payload)
            dismiss()
        } catch {
            submitError = error.localizedDescription
        }
    }
}
