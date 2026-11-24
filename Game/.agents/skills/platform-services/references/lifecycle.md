# App lifecycle in a plugin

**App lifecycle in a plugin.** Implement the lifecycle listener (every method optional, main thread)
instead of registering OS callbacks yourself:

```kotlin
class StoreAcmePlugin : GameEnginePlugin, StoreService, GameEngineLifecycleListener {
    override fun onApplicationCreate(app: Application) { Acme.init(app) } // process start, before any Activity (state: companion object)
    override fun install(services: GameEngineServices, context: GameEnginePluginContext) {
        GameEngineServicesHost.instance?.addLifecycleListener(this)
    }
    override fun onPause(activity: Activity) { sdk.flush() }        // the game Activity, before the engine hears it
    override fun onCover(callback: String, activity: Activity) {}    // another Activity of the app: an ad, billing
    override fun onAppBackground() {}                                // the last Activity of the app stopped
    override fun onHandled(state: String) {}                         // app.onLifecycle's listeners and save flush have run
}
// a result that belongs to you, with no request code to pick:
GameEngineServicesHost.instance?.requestPermissions(arrayOf(POST_NOTIFICATIONS)) { answers -> }
GameEngineServicesHost.instance?.startForResult(intent) { resultCode, data -> }
```

```swift
final class StoreAcmePlugin: GameEnginePlugin, StoreService, GameEngineLifecycleListener {
    func didFinishLaunching(_ application: UIApplication, options: [UIApplication.LaunchOptionsKey: Any]?) { Acme.configure() }
    func install(_ services: GameEngineServices, _ context: GameEnginePluginContext) { GameEngineLifecycle.shared.add(self) }
    func didEnterBackground() { sdk.flush() }   // before the engine hears it
    func presented(_ screen: String) {}          // a screen over the game window: an ad, a sheet
    func handled(_ state: String) {}
}
```

Android also hears `onStart`, `onResume`, `onStop`, `onSaveInstanceState`, `onDestroy`, `onNewIntent`,
`onWindowFocusChanged`, `onConfigurationChanged`, `onTrimMemory`, `onUserLeaveHint` and `onAppForeground`.
iOS also hears active and foreground changes, `willTerminate`, memory warnings, `significantTimeChange`,
`openURL`, the game view controller's appear/disappear, safe area and size, `dismissed` and `windowKey`.
Plugins never hear a transition a test or the debug protocol injects. Each event is a `[lifecycle]`
line in the device log, so a device test can check what a plugin was told. Plugins are created once
per process for the early hook; an Activity recreated later installs new instances, so what
`onApplicationCreate` / `didFinishLaunching` set up lives in a companion object or a static.
