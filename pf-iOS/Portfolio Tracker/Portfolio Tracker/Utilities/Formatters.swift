import Foundation

enum Formatters {

    // MARK: - Currency

    static func cny(_ value: Double) -> String {
        "¥" + decimal(value, places: 2)
    }

    static func usd(_ value: Double) -> String {
        "$" + decimal(value, places: 2)
    }

    static func value(_ value: Double, currency: Currency) -> String {
        currency == .cny ? cny(value) : usd(value)
    }

    // MARK: - Quantity (variable precision, strips trailing zeros)

    static func quantity(_ value: Double) -> String {
        if value.truncatingRemainder(dividingBy: 1) == 0 {
            return String(format: "%.0f", value)
        }
        var result = String(format: "%.6f", value)
        while result.hasSuffix("0") { result.removeLast() }
        if result.hasSuffix(".") { result.removeLast() }
        return result
    }

    // MARK: - Percentage (always shows sign)

    static func percent(_ value: Double) -> String {
        let prefix = value >= 0 ? "+" : ""
        return "\(prefix)\(String(format: "%.2f", value))%"
    }

    // MARK: - Date

    static func date(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f.string(from: date)
    }

    // MARK: - Private

    private static let twoDecimal: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f
    }()

    private static func decimal(_ value: Double, places: Int) -> String {
        twoDecimal.string(from: NSNumber(value: value)) ?? String(format: "%.\(places)f", value)
    }
}
