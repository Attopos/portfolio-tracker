import SwiftUI

struct ErrorBanner: View {
    let message: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(PTTheme.negative)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(PTTheme.text)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .portfolioCard()
    }
}
