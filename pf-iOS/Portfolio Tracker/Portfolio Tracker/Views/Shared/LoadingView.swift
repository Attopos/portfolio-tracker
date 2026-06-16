import SwiftUI

struct LoadingView: View {
    var message: String = "Loading..."

    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .tint(PTTheme.accent)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(PTTheme.textMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PTTheme.canvas.ignoresSafeArea())
    }
}
