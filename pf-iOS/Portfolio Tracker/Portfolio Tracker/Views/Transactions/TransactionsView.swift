import SwiftUI

struct TransactionsView: View {
    @Environment(PortfolioViewModel.self) private var portfolio
    @State private var showAddSheet = false

    var body: some View {
        NavigationStack {
            Group {
                if portfolio.isTransactionsLoading && portfolio.transactions.isEmpty {
                    LoadingView()
                } else if let error = portfolio.transactionsError, portfolio.transactions.isEmpty {
                    ErrorBanner(message: error)
                } else if portfolio.transactions.isEmpty {
                    ContentUnavailableView(
                        "No Transactions",
                        systemImage: "arrow.left.arrow.right.circle",
                        description: Text("Tap + to record your first trade.")
                    )
                } else {
                    List {
                        ForEach(portfolio.transactions) { txn in
                            TransactionRow(transaction: txn)
                        }
                        .onDelete { offsets in
                            let ids = offsets.map { portfolio.transactions[$0].id }
                            Task {
                                for id in ids {
                                    try? await portfolio.deleteTransaction(id: id)
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Transactions")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button { showAddSheet = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddSheet) {
                AddTransactionView()
            }
            .refreshable {
                await portfolio.loadTransactions()
            }
        }
    }
}
