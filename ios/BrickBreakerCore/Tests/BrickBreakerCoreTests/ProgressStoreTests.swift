import Foundation
import SwiftData
import Testing
@testable import BrickBreakerCore

@MainActor
private func makeStore() throws -> ProgressStore {
    let container = try ModelContainer(for: LevelResult.self, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
    return ProgressStore(context: ModelContext(container))
}

@MainActor
@Test func recordKeepsTheBestOfEachLevel() throws {
    let store = try makeStore()
    try store.record(level: 4, stars: 2, score: 300)
    try store.record(level: 4, stars: 1, score: 900)   // fewer stars, higher score
    try store.record(level: 4, stars: 3, score: 100)   // more stars, lower score
    let rows = try store.results()
    #expect(rows.count == 1)
    #expect(rows[0].stars == 3 && rows[0].bestScore == 900)
    #expect(try store.totalStars() == 3)
}

@MainActor
@Test func recordClampsUntrustedValues() throws {
    let store = try makeStore()
    try store.record(level: 0, stars: 9, score: -5)
    #expect(try store.results()[0].stars == 3)
    #expect(try store.results()[0].bestScore == 0)
}

@MainActor
@Test func seedScriptMirrorsTheDatabase() throws {
    let store = try makeStore()
    #expect(try store.seedScript() == "try{localStorage.bb_stars='{}';localStorage.bb_best='{}'}catch(e){}")
    try store.record(level: 0, stars: 3, score: 1230)
    try store.record(level: 11, stars: 1, score: 40)
    #expect(try store.seedScript() == "try{localStorage.bb_stars='{\"0\":3,\"11\":1}';localStorage.bb_best='{\"0\":1230,\"11\":40}'}catch(e){}")
    try store.reset()
    #expect(try store.results().isEmpty)
}

@Test func gameMessageParsesOnlyWellFormedBodies() {
    #expect(GameMessage(body: ["type": "level", "level": 3, "stars": 2, "score": 500]) == .levelDone(level: 3, stars: 2, score: 500))
    #expect(GameMessage(body: ["type": "level", "level": 3.0, "stars": 2.0, "score": 500.0]) == .levelDone(level: 3, stars: 2, score: 500)) // JS numbers arrive as doubles
    #expect(GameMessage(body: ["type": "haptic"]) == .haptic)
    #expect(GameMessage(body: ["type": "stats"]) == .stats)
    #expect(GameMessage(body: ["type": "level", "level": "3"]) == nil)
    #expect(GameMessage(body: ["type": "level", "level": -1, "stars": 2, "score": 5]) == nil)
    #expect(GameMessage(body: "hello") == nil)
}
