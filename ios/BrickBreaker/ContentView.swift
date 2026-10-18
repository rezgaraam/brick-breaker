import BrickBreakerCore
import SwiftData
import SwiftUI

struct ContentView: View {
    @Environment(\.modelContext) private var context
    @State private var showStats = false
    @State private var hapticTick = 0
    @State private var reloadToken = 0

    var body: some View {
        GameView(reloadToken: reloadToken, seed: { (try? ProgressStore(context: context).seedScript()) ?? "" }) { message in
            switch message {
            case let .levelDone(level, stars, score):
                try? ProgressStore(context: context).record(level: level, stars: stars, score: score)
            case .haptic:
                hapticTick &+= 1
            case .stats:
                showStats = true
            }
        }
        .ignoresSafeArea()
        .background(.black)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        .sensoryFeedback(.impact(weight: .light), trigger: hapticTick)
        .sheet(isPresented: $showStats) {
            StatsView(onReset: { reloadToken += 1 })
        }
    }
}

#Preview {
    ContentView()
        .modelContainer(for: LevelResult.self, inMemory: true)
}
