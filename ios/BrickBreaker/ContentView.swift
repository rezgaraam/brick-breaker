import BrickBreakerCore
import OSLog
import SwiftData
import SwiftUI

private let log = Logger(subsystem: "com.rezgaraam.BrickBreaker", category: "progress")

struct ContentView: View {
    @Environment(\.modelContext) private var context
    @State private var showStats = false
    @State private var hapticTick = 0
    @State private var reloadToken = 0

    var body: some View {
        GameView(reloadToken: reloadToken, seed: { (try? ProgressStore(context: context).seedScript()) ?? "" }) { message in
            switch message {
            case let .levelDone(level, stars, score):
                do { try ProgressStore(context: context).record(level: level, stars: stars, score: score) }
                catch { log.error("could not save level \(level): \(error)") } // the page keeps its own copy until next launch
            case .haptic:
                hapticTick &+= 1
            case .stats:
                showStats = true
            case .reset:
                do { try ProgressStore(context: context).reset() } catch { log.error("could not reset progress: \(error)") }
                reloadToken += 1
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
