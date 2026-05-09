import SwiftUI

struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(transaction.transactionType.rawValue.uppercased())
                .font(.caption.bold())
                .padding(.horizontal, 7)
                .padding(.vertical, 3)
                .background(typeColor.opacity(0.15))
                .foregroundStyle(typeColor)
                .clipShape(Capsule())
                .padding(.top, 2)

            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.assetName)
                    .font(.headline)
                Text(Formatters.date(transaction.transactedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(Formatters.quantity(transaction.quantity))
                    .font(.headline)
                if let price = transaction.unitPrice {
                    Text("@ \(Formatters.value(price, currency: transaction.currency))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 2)
    }

    private var typeColor: Color {
        switch transaction.transactionType {
        case .buy:  .green
        case .sell: .red
        case .set:  .blue
        }
    }
}
