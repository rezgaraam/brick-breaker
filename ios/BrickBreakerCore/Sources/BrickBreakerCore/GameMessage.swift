import Foundation

/// Messages the web game posts to the native shell through `webkit.messageHandlers.game`.
public enum GameMessage: Equatable {
    case levelDone(level: Int, stars: Int, score: Int)
    case haptic
    case stats

    /// Parses a `WKScriptMessage.body`. Anything malformed is dropped (`nil`), never trusted.
    public init?(body: Any) {
        guard let dict = body as? [String: Any], let type = dict["type"] as? String else { return nil }
        switch type {
        case "level":
            // JS numbers arrive as NSNumber doubles (3.0); accept only exact integers.
            func int(_ value: Any?) -> Int? { (value as? NSNumber).flatMap { Int(exactly: $0.doubleValue) } }
            guard let level = int(dict["level"]), let stars = int(dict["stars"]), let score = int(dict["score"]),
                  (0..<1000).contains(level) else { return nil }
            self = .levelDone(level: level, stars: stars, score: score)
        case "haptic": self = .haptic
        case "stats": self = .stats
        default: return nil
        }
    }
}
