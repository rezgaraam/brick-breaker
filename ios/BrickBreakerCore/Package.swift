// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "BrickBreakerCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "BrickBreakerCore", targets: ["BrickBreakerCore"])],
    targets: [
        .target(name: "BrickBreakerCore", swiftSettings: [.swiftLanguageMode(.v5)]),
        .testTarget(name: "BrickBreakerCoreTests", dependencies: ["BrickBreakerCore"], swiftSettings: [.swiftLanguageMode(.v5)]),
    ]
)
