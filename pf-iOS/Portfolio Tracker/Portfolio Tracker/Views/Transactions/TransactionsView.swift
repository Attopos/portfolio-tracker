import SwiftUI

struct TransactionsView: View {
    @Environment(PortfolioViewModel.self) private var portfolio
    @State private var showAddSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    PTPageHeader(
                        eyebrow: "Ledger",
                        title: "Recent transactions",
                        trailing: AnyView(
                            Button { showAddSheet = true } label: {
                                Label("New trade", systemImage: "plus")
                                    .font(.subheadline.weight(.bold))
                            }
                            .buttonStyle(PTAccentButtonStyle())
                        )
                    )

                    content
                }
                .padding(18)
            }
            .portfolioScreenBackground()
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(isPresented: $showAddSheet) {
                AddTransactionView()
                    .presentationDetents([.large])
            }
            .refreshable {
                await portfolio.loadTransactions()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        if portfolio.isTransactionsLoading && portfolio.transactions.isEmpty {
            LoadingView()
                .frame(minHeight: 260)
        } else if let error = portfolio.transactionsError, portfolio.transactions.isEmpty {
            ErrorBanner(message: error)
        } else if portfolio.transactions.isEmpty {
            PTEmptyState(
                title: "No Transactions",
                message: "Tap New trade to record your first transaction.",
                systemImage: "arrow.left.arrow.right.circle"
            )
        } else {
            VStack(spacing: 10) {
                ForEach(portfolio.transactions) { txn in
                    TransactionRow(transaction: txn)
                        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                            Button(role: .destructive) {
                                Task { try? await portfolio.deleteTransaction(id: txn.id) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        }
                }
            }
        }
    }
}

struct PTAccentButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.black)
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .background(PTTheme.accent.opacity(configuration.isPressed ? 0.78 : 0.96))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .shadow(color: PTTheme.accent.opacity(0.18), radius: 12, y: 7)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
    }
}
