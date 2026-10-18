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
        addScripts(to: config.userContentController)

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
        context.coordinator.webView = webView
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
        addScripts(to: controller)
        load(webView)
    }

    /// Document-start scripts: the progress seed, and the phone's language (the page's "Automatic" language).
    private func addScripts(to controller: WKUserContentController) {
        let lang = (Locale.preferredLanguages.first ?? "en").filter { $0.isLetter || $0 == "-" }
        for source in [seed(), "window.nativeLang='\(lang)'"] {
            controller.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
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
        weak var webView: WKWebView?
        private var resignObserver: NSObjectProtocol?

        init(onMessage: @escaping (GameMessage) -> Void) {
            self.onMessage = onMessage
            super.init()
            // Pause the game whenever the app stops being active: background, a call, Control Center, a banner.
            resignObserver = NotificationCenter.default.addObserver(
                forName: UIApplication.willResignActiveNotification, object: nil, queue: .main
            ) { [weak self] _ in
                self?.webView?.evaluateJavaScript("autoPause()")
            }
        }

        deinit {
            if let resignObserver { NotificationCenter.default.removeObserver(resignObserver) }
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let parsed = GameMessage(body: message.body) else { return }
            onMessage(parsed)
        }
    }
}
