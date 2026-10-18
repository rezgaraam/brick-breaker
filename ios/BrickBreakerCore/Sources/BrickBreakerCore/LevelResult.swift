import Foundation
import SwiftData

/// One row per level the player has cleared. `level` is the 0-based index used by the web game.
@Model
public final class LevelResult {
    @Attribute(.unique) public var level: Int
    public var stars: Int
    public var bestScore: Int
    public var playedAt: Date

    public init(level: Int, stars: Int, bestScore: Int, playedAt: Date = .now) {
        self.level = level
        self.stars = stars
        self.bestScore = bestScore
        self.playedAt = playedAt
    }
}
