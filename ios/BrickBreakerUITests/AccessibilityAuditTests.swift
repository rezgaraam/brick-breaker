import XCTest

/// Apple's automated accessibility audit on each distinct screen. Fails on any finding not explicitly accepted below.
final class AccessibilityAuditTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = true
        app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 10))
    }

    private func audit(_ screen: String) throws {
        try app.performAccessibilityAudit { [app] issue in
            // Accepted: the system toolbar buttons of the stats sheet (Apple's own control) report partial
            // Dynamic Type support; our content is all system text styles.
            if issue.auditType == .dynamicType, let label = issue.element?.label,
               app!.navigationBars.buttons[label].exists { return true }
            // Accepted: WebKit reports non-interactive page content (HUD score/level/lives, the card's info line) as a
            // possible tap target; the hit-area rule is for controls, and buttons/switches are still checked.
            if issue.auditType == .hitRegion, let type = issue.element?.elementType,
               [.staticText, .image].contains(type) { return true }
            print("A11Y[\(screen)] \(issue.auditType) | \(issue.compactDescription) | label='\(issue.element?.label ?? "-")' frame=\(issue.element?.frame ?? .zero)")
            return false
        }
    }

    @MainActor func testMenu() throws {
        XCTAssertTrue(app.buttons["Progress"].waitForExistence(timeout: 10))
        try audit("menu")
    }

    @MainActor func testSettings() throws {
        let gear = app.buttons["Settings"]
        XCTAssertTrue(gear.waitForExistence(timeout: 10))
        gear.tap()
        XCTAssertTrue(app.switches["Music"].waitForExistence(timeout: 5))
        try audit("settings")
    }

    @MainActor func testPauseCard() throws {
        XCTAssertTrue(app.buttons["Level 1"].waitForExistence(timeout: 10))
        app.buttons["Level 1"].tap()
        app.buttons["Pause"].tap()
        XCTAssertTrue(app.buttons["Resume"].waitForExistence(timeout: 5))
        try audit("pause")
    }

    @MainActor func testPlaying() throws {
        XCTAssertTrue(app.buttons["Level 1"].waitForExistence(timeout: 10))
        app.buttons["Level 1"].tap()
        XCTAssertTrue(app.buttons["Pause"].waitForExistence(timeout: 5))
        try audit("ready")
    }

    @MainActor func testStats() throws {
        XCTAssertTrue(app.buttons["Progress"].waitForExistence(timeout: 10))
        app.buttons["Progress"].tap()
        XCTAssertTrue(app.navigationBars["Progress"].waitForExistence(timeout: 5))
        try audit("stats")
    }
}
