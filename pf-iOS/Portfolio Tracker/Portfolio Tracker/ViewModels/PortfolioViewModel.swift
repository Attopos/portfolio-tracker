import Foundation
import Observation

@Observable
@MainActor
final class PortfolioViewModel {

    // MARK: - State

    var positions: [Position] = []
    var transactions: [Transaction] = []
    var marketPrices: [String: MarketPrice] = [:]
    var fxRate: Double = 6.91
    var dailySummary: DailySummary?
    var historyPoints: [HistoryPoint] = []
    var selectedRange: HistoryRange = .thirtyDays

    var isPositionsLoading = false
    var isTransactionsLoading = false
    var positionsError: String?
    var transactionsError: String?

    // MARK: - Services

    private let positionService: PositionService
    private let transactionService: TransactionService
    private let marketDataService: MarketDataService
    private let historyService: PortfolioHistoryService

    init(
        positionService: PositionService = PositionService(),
        transactionService: TransactionService = TransactionService(),
        marketDataService: MarketDataService = MarketDataService(),
        historyService: PortfolioHistoryService = PortfolioHistoryService()
    ) {
        self.positionService = positionService
        self.transactionService = transactionService
        self.marketDataService = marketDataService
        self.historyService = historyService
    }

    // MARK: - Computed

    var totalValueCNY: Double {
        PortfolioMetrics.totalValueCNY(positions: positions, marketPrices: marketPrices, fxRate: fxRate)
    }

    var totalValueUSD: Double {
        PortfolioMetrics.totalValueUSD(positions: positions, marketPrices: marketPrices, fxRate: fxRate)
    }

    // MARK: - Load

    func loadAll() async {
        async let pos: Void = loadPositions()
        async let txn: Void = loadTransactions()
        _ = await (pos, txn)
        await loadMarketData()
        await loadDailySummary()
    }

    func loadPositions() async {
        isPositionsLoading = true
        positionsError = nil
        defer { isPositionsLoading = false }
        do {
            positions = try await positionService.fetchAll()
        } catch {
            positionsError = error.localizedDescription
        }
    }

    func loadTransactions() async {
        isTransactionsLoading = true
        transactionsError = nil
        defer { isTransactionsLoading = false }
        do {
            transactions = try await transactionService.fetchAll()
        } catch {
            transactionsError = error.localizedDescription
        }
    }

    func loadMarketData() async {
        // Pass all position IDs; the server normalises and filters to known symbols.
        let symbols = Array(Set(positions.map { $0.id.uppercased() }))
        guard !symbols.isEmpty else { return }
        do {
            async let prices = marketDataService.fetchPrices(for: symbols)
            async let fx = marketDataService.fetchFXRate()
            marketPrices = try await prices
            fxRate = try await fx.rate
        } catch {
            // Non-critical — keep last known values
        }
    }

    func loadDailySummary() async {
        do {
            dailySummary = try await historyService.fetchDailySummary()
        } catch {
            // Non-critical
        }
    }

    func loadHistory() async {
        do {
            historyPoints = try await historyService.fetchHistory(range: selectedRange)
        } catch {
            // Non-critical
        }
    }

    // MARK: - Mutations

    func addTransaction(_ payload: CreateTransactionPayload) async throws {
        _ = try await transactionService.create(payload)
        await loadPositions()
        await loadTransactions()
        await loadMarketData()
        await loadDailySummary()
    }

    func deleteTransaction(id: Int) async throws {
        try await transactionService.delete(id: id)
        await loadPositions()
        await loadTransactions()
        await loadDailySummary()
    }

    func updatePosition(
        assetId: String,
        position: Double? = nil,
        manualMarketPrice: Double? = nil,
        clearManualPrice: Bool = false
    ) async throws {
        let updated = try await positionService.update(
            assetId: assetId,
            position: position,
            manualMarketPrice: manualMarketPrice,
            clearManualPrice: clearManualPrice
        )
        if let i = positions.firstIndex(where: { $0.id == assetId }) {
            positions[i] = updated
        }
        await loadDailySummary()
    }

    func deletePosition(assetId: String) async throws {
        try await positionService.delete(assetId: assetId)
        positions.removeAll { $0.id == assetId }
        transactions.removeAll { $0.assetId == assetId }
        await loadDailySummary()
    }
}
