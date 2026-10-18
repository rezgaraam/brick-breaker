import AVFoundation
import BrickBreakerCore
import SwiftData
import SwiftUI

@main
struct BrickBreakerApp: App {
    init() {
        // Game audio respects the silent switch and mixes with the player's own music.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers)
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
        }
        .modelContainer(for: LevelResult.self)
    }
}
