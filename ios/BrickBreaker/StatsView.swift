import BrickBreakerCore
import SwiftData
import SwiftUI

/// Native progress screen over the same database the game writes to.
struct StatsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query(sort: \LevelResult.level) private var results: [LevelResult]
    @State private var confirmReset = false
    var onReset: () -> Void

    private var totalStars: Int { results.reduce(0) { $0 + $1.stars } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("Levels cleared", value: results.count, format: .number)
                    LabeledContent("Stars", value: "\(totalStars) / 300")
                    LabeledContent("Best score", value: results.map(\.bestScore).max() ?? 0, format: .number)
                }
                Section {
                    ForEach(results) { result in
                        LevelRow(result: result)
                    }
                } header: {
                    Text("Levels")
                }
            }
            .overlay {
                if results.isEmpty {
                    ContentUnavailableView("No levels cleared yet", systemImage: "star", description: Text("Finish a level and it shows up here."))
                }
            }
            .navigationTitle("Progress")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .destructiveAction) {
                    Button("Reset", role: .destructive) { confirmReset = true }
                        .disabled(results.isEmpty)
                }
            }
            .confirmationDialog("Reset all progress?", isPresented: $confirmReset, titleVisibility: .visible) {
                Button("Reset", role: .destructive) {
                    try? ProgressStore(context: context).reset()
                    onReset()
                    dismiss()
                }
            } message: {
                Text("Stars and best scores for every level will be deleted. This cannot be undone.")
            }
        }
    }
}

private struct LevelRow: View {
    let result: LevelResult

    var body: some View {
        LabeledContent("Level \(result.level + 1)") {
            HStack(spacing: 12) {
                Text(String(repeating: "★", count: result.stars) + String(repeating: "☆", count: 3 - result.stars))
                    .foregroundStyle(.yellow)
                Text(result.bestScore, format: .number)
                    .monospacedDigit()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Level \(result.level + 1), \(result.stars) of 3 stars, best score \(result.bestScore)")
    }
}

#Preview {
    StatsView(onReset: {})
        .modelContainer(for: LevelResult.self, inMemory: true)
}
