import BrickBreakerCore
import SwiftUI
import WebKit

/// The web game in a WKWebView. `seed` is injected at document start so the page boots from the
/// database; `onMessage` receives what the page posts to `webkit.messageHandlers.game`.
struct GameView: UIViewRepresentable {
    var reloadToken: Int
    var seed: () -> String
    var onMessage: (GameMessage) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onMessage: onMessage) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []     // WebAudio starts on the game's own first tap
        config.userContentController.add(context.coordinator, name: "game")
        config.userContentController.addUserScript(WKUserScript(source: seed(), injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        #if DEBUG
        webView.isInspectable = true
        #endif
        context.coordinator.reloadToken = reloadToken
        load(webView)
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.onMessage = onMessage
        guard context.coordinator.reloadToken != reloadToken else { return }
        context.coordinator.reloadToken = reloadToken
        // Progress was reset: re-seed and reload so the page matches the database again.
        let controller = webView.configuration.userContentController
        controller.removeAllUserScripts()
        controller.addUserScript(WKUserScript(source: seed(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
        load(webView)
    }

    private func load(_ webView: WKWebView) {
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html") else {
            assertionFailure("index.html missing from bundle; check the Copy Bundle Resources phase")
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var onMessage: (GameMessage) -> Void
        var reloadToken = 0

        init(onMessage: @escaping (GameMessage) -> Void) { self.onMessage = onMessage }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let parsed = GameMessage(body: message.body) else { return }
            onMessage(parsed)
        }
    }
}
