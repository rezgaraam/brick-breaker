import Foundation
import SwiftData

/// All reads and writes of player progress. The database is the source of truth;
/// the web game's localStorage is primed from it on every launch via `seedScript()`.
@MainActor
public struct ProgressStore {
    private let context: ModelContext

    public init(context: ModelContext) { self.context = context }

    /// Upsert: stars and best score only ever go up.
    public func record(level: Int, stars: Int, score: Int) throws {
        let stars = min(max(stars, 0), 3), score = max(score, 0)
        if let row = try results(for: level).first {
            row.stars = max(row.stars, stars)
            row.bestScore = max(row.bestScore, score)
            row.playedAt = .now
        } else {
            context.insert(LevelResult(level: level, stars: stars, bestScore: score))
        }
        try context.save()
    }

    public func results() throws -> [LevelResult] {
        try context.fetch(FetchDescriptor<LevelResult>(sortBy: [SortDescriptor(\.level)]))
    }

    public func totalStars() throws -> Int { try results().reduce(0) { $0 + $1.stars } }

    public func reset() throws {
        try context.delete(model: LevelResult.self)
        try context.save()
    }

    /// JavaScript injected at document start so the game boots with the database's view of progress.
    public func seedScript() throws -> String {
        let rows = try results()
        let stars = Dictionary(uniqueKeysWithValues: rows.map { (String($0.level), $0.stars) })
        let best = Dictionary(uniqueKeysWithValues: rows.map { (String($0.level), $0.bestScore) })
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        func json(_ d: [String: Int]) throws -> String { String(decoding: try encoder.encode(d), as: UTF8.self) }
        // Only digits, quotes, braces, colons and commas can appear, so single quotes are safe.
        return "try{localStorage.bb_stars='\(try json(stars))';localStorage.bb_best='\(try json(best))'}catch(e){}"
    }

    private func results(for level: Int) throws -> [LevelResult] {
        try context.fetch(FetchDescriptor<LevelResult>(predicate: #Predicate { $0.level == level }))
    }
}
