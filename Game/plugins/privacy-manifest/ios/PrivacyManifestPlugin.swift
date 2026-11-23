import Foundation

/// Carries PrivacyInfo.xcprivacy into the app: the engine copies a plugin's ios/ folder into the Xcode
/// project, and Xcode bundles the manifest at the app's root. The class itself does nothing.
final class PrivacyManifestPlugin: GameEnginePlugin {
    func install(_ services: GameEngineServices, _ context: GameEnginePluginContext) {}
}
