import Foundation

/// A single hourly portfolio value snapshot from portfolio_value_snapshots.
/// `capturedAt` is guaranteed unique per user per hour bucket (the backend
/// upserts one row per hour), so it is safe to use as the Identifiable id.
struct HistoryPoint: Decodable, Identifiable, Hashable {
    let totalUsd: Double
    let capturedAt: Date

    var id: Date { capturedAt }
}

/// 24-hour P&L summary computed server-side against the nearest stored baseline.
/// When no baseline exists (e.g. first session), `baselineCapturedAt` is nil and
/// all change values are 0.
struct DailySummary: Decodable, Hashable {
    let baselineCapturedAt: Date?
    let baselineTotalCny: Double
    let currentTotalCny: Double
    /// Percentage change from baseline, e.g. 1.42 means +1.42 %.
    let dailyPnlPct: Double
    let dailyPnlCny: Double
}

// MARK: - Response envelopes

/// Returned by GET /api/portfolio-history?range=7d|30d|90d|1y
struct PortfolioHistoryResponse: Decodable {
    let ok: Bool
    let range: String
    let points: [HistoryPoint]
}

/// Returned by GET /api/portfolio-history/summary
struct DailySummaryResponse: Decodable {
    let ok: Bool
    let summary: DailySummary
}

// MARK: - History range selector

enum HistoryRange: String, CaseIterable, Identifiable {
    case sevenDays  = "7d"
    case thirtyDays = "30d"
    case ninetyDays = "90d"
    case oneYear    = "1y"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .sevenDays:  "7D"
        case .thirtyDays: "30D"
        case .ninetyDays: "90D"
        case .oneYear:    "1Y"
        }
    }
}
