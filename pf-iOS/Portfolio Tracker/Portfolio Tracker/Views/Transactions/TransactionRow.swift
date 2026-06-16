import SwiftUI

struct TransactionRow: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let transaction: Transaction

    var body: some View {
        Group {
            if horizontalSizeClass == .compact {
                VStack(alignment: .leading, spacing: 12) {
                    identity
                    values
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                HStack(alignment: .center, spacing: 13) {
                    identity
                    Spacer(minLength: 8)
                    values
                }
            }
        }
        .padding(16)
        .background(PTTheme.surface)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var identity: some View {
        HStack(alignment: .center, spacing: 13) {
            Text(transaction.transactionType.rawValue.uppercased())
                .font(.caption.weight(.heavy))
                .foregroundStyle(typeColor)
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
                .background(typeColor.opacity(0.14))
                .clipShape(Capsule())

            VStack(alignment: .leading, spacing: 5) {
                Text(transaction.assetName)
                    .font(.headline)
                    .foregroundStyle(PTTheme.textStrong)
                    .lineLimit(1)
                Text(Formatters.date(transaction.transactedAt))
                    .font(.caption)
                    .foregroundStyle(PTTheme.textMuted)
            }
        }
    }

    private var values: some View {
        VStack(alignment: horizontalSizeClass == .compact ? .leading : .trailing, spacing: 5) {
            Text(Formatters.quantity(transaction.quantity))
                .font(.headline)
                .foregroundStyle(PTTheme.textStrong)
                .monospacedDigit()
            if let price = transaction.unitPrice {
                Text("@ \(Formatters.value(price, currency: transaction.currency))")
                    .font(.caption)
                    .foregroundStyle(PTTheme.textMuted)
                    .monospacedDigit()
            }
        }
    }

    private var typeColor: Color {
        switch transaction.transactionType {
        case .buy, .set: PTTheme.accent
        case .sell: PTTheme.negative
        }
    }
}
