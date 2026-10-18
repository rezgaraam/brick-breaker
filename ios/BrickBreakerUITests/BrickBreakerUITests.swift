import XCTest

/// Drives the real app on a simulator: the web game must reach the native shell through the
/// message bridge (tapping STATS in the page opens the SwiftUI stats sheet).
final class BrickBreakerUITests: XCTestCase {
    @MainActor
    func testStatsSheetOpensFromTheGameMenu() throws {
        let app = XCUIApplication()
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 10), "game web view not shown")
        // STATS is a real HTML button the page shows only inside the native shell.
        let stats = app.buttons["STATS"]
        XCTAssertTrue(stats.waitForExistence(timeout: 10), "STATS button not exposed by the page")
        stats.tap()

        let opened = app.navigationBars["Progress"].waitForExistence(timeout: 5)
        if !opened { print("UITEST tree after tap:\n" + app.debugDescription) }
        XCTAssertTrue(opened, "native stats sheet did not open")
        XCTAssertTrue(app.staticTexts["No levels cleared yet"].exists)
        let shot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        shot.name = "stats-sheet"; shot.lifetime = .keepAlways
        add(shot)
        app.buttons["Done"].tap()
        XCTAssertTrue(app.navigationBars["Progress"].waitForNonExistence(timeout: 5))
    }

    /// Assisted play is reachable without touching the playfield: switch it on, pick a level, press Launch.
    @MainActor
    func testAssistedPlayIsButtonDriven() throws {
        let app = XCUIApplication()
        app.launch()
        let gear = app.buttons["Settings"]
        XCTAssertTrue(gear.waitForExistence(timeout: 10))
        gear.tap()
        let assist = app.switches["Assisted play"]
        XCTAssertTrue(assist.waitForExistence(timeout: 5))
        if assist.value as? String != "1" { assist.tap() }
        app.buttons["Close"].tap()
        app.buttons["Level 1"].tap()
        let launch = app.buttons["Launch"]
        XCTAssertTrue(launch.waitForExistence(timeout: 5), "Launch button not shown in assisted mode")
        launch.tap()
        XCTAssertTrue(launch.waitForNonExistence(timeout: 5), "game did not start")
        sleep(5)
        XCTAssertFalse(app.buttons["Retry"].exists, "assisted paddle lost every ball within 5s")
        // leave the default state for other tests
        app.buttons["MENU"].tap(); gear.tap(); assist.tap(); app.buttons["Close"].tap()
    }
}
