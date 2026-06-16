import SwiftUI

enum PTTheme {
    static let canvas = Color(red: 17 / 255, green: 17 / 255, blue: 17 / 255)
    static let surface = Color(red: 31 / 255, green: 32 / 255, blue: 36 / 255)
    static let surface2 = Color(red: 38 / 255, green: 39 / 255, blue: 44 / 255)
    static let surface3 = Color(red: 47 / 255, green: 48 / 255, blue: 54 / 255)
    static let line = Color(red: 86 / 255, green: 91 / 255, blue: 102 / 255).opacity(0.32)
    static let text = Color(red: 236 / 255, green: 232 / 255, blue: 222 / 255)
    static let textStrong = Color(red: 246 / 255, green: 242 / 255, blue: 234 / 255)
    static let textMuted = Color(red: 155 / 255, green: 159 / 255, blue: 168 / 255)
    static let textSoft = Color(red: 198 / 255, green: 192 / 255, blue: 182 / 255)
    static let accent = Color(red: 197 / 255, green: 255 / 255, blue: 71 / 255)
    static let accentSoft = Color(red: 197 / 255, green: 255 / 255, blue: 71 / 255).opacity(0.14)
    static let negative = Color(red: 255 / 255, green: 139 / 255, blue: 120 / 255)
    static let chartColors: [Color] = [
        accent,
        Color(red: 143 / 255, green: 220 / 255, blue: 79 / 255),
        Color(red: 98 / 255, green: 216 / 255, blue: 139 / 255),
        Color(red: 63 / 255, green: 184 / 255, blue: 162 / 255),
        Color(red: 110 / 255, green: 158 / 255, blue: 88 / 255),
        Color(red: 173 / 255, green: 202 / 255, blue: 160 / 255),
    ]
}

struct PTCardModifier: ViewModifier {
    var padding: CGFloat = 18

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(PTTheme.surface)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .shadow(color: .black.opacity(0.18), radius: 18, x: 0, y: 12)
    }
}

extension View {
    func portfolioCard(padding: CGFloat = 18) -> some View {
        modifier(PTCardModifier(padding: padding))
    }

    func portfolioScreenBackground() -> some View {
        background(PTTheme.canvas.ignoresSafeArea())
            .scrollContentBackground(.hidden)
            .toolbarBackground(PTTheme.canvas, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

struct PTPageHeader: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    let eyebrow: String
    let title: String
    var trailing: AnyView?

    init(eyebrow: String, title: String, trailing: AnyView? = nil) {
        self.eyebrow = eyebrow
        self.title = title
        self.trailing = trailing
    }

    var body: some View {
        if horizontalSizeClass == .compact, let trailing {
            VStack(alignment: .leading, spacing: 14) {
                titleBlock
                trailing
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        } else {
            HStack(alignment: .bottom, spacing: 16) {
                titleBlock
                Spacer(minLength: 8)
                trailing
            }
        }
    }

    private var titleBlock: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text(eyebrow.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(PTTheme.accent)
            Text(title)
                .font(.system(size: 34, weight: .semibold, design: .rounded))
                .foregroundStyle(PTTheme.textStrong)
                .lineLimit(3)
                .minimumScaleFactor(0.78)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct PTAdaptiveStack<Content: View>: View {
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var spacing: CGFloat = 14
    @ViewBuilder let content: Content

    var body: some View {
        if horizontalSizeClass == .compact {
            VStack(alignment: .leading, spacing: spacing) {
                content
            }
        } else {
            HStack(alignment: .top, spacing: spacing) {
                content
            }
        }
    }
}

struct PTAssetBadge: View {
    let symbol: String

    var body: some View {
        Text(symbol.prefix(3).uppercased())
            .font(.caption.weight(.heavy))
            .foregroundStyle(Color.black)
            .frame(width: 42, height: 42)
            .background(
                LinearGradient(
                    colors: [PTTheme.accent.opacity(0.98), PTTheme.accent.opacity(0.86)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            )
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

struct PTMetricCard: View {
    let label: String
    let systemImage: String
    let value: String
    var footer: String?
    var valueColor: Color = PTTheme.textStrong

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: systemImage)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(PTTheme.accent)
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(PTTheme.textSoft)
            }

            Text(value)
                .font(.system(size: 24, weight: .medium, design: .rounded))
                .foregroundStyle(valueColor)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.72)

            if let footer {
                Text(footer)
                    .font(.footnote)
                    .foregroundStyle(PTTheme.textMuted)
                    .monospacedDigit()
                    .lineLimit(2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .portfolioCard(padding: 20)
    }
}

struct PTEmptyState: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .semibold))
                .foregroundStyle(PTTheme.accent)
            Text(title)
                .font(.headline)
                .foregroundStyle(PTTheme.textStrong)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(PTTheme.textMuted)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .portfolioCard(padding: 28)
    }
}
