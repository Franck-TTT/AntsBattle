# Engine cheats: store screenshots

`engine.capture` (**Store screenshots**) turns one frozen moment of real gameplay into the store
set: every store size, each laid out with its own size, density and safe area, in every language
the game has, as RGB PNGs (no alpha, which both stores refuse) at the exact pixel sizes.

1. Play to the moment (the editor's Play, `gameengine run`, the desktop player).
2. Press **F9** (or run the cheat with `action=freeze`). The game holds as under the editor's Pause:
   no steps, no UI time, and every input but releases is dropped (not kept for later). A blue bar
   at the bottom shows the keys.
3. Press **Enter** (or `action=capture`). The bar says "Capturing…", then how many PNGs went
   where and how long it took.
4. Press **Escape** or **F9** (or `action=resume`) to play on.

Files go to `screenshots/store/<UTC time>/<shot>/<language>.png` in the project, with a
`capture-<UTC time>.json` (the step, each shot's size, scale and safe area, each file, each error). The bar,
the error banner and the cheat console never show in a capture. Defaults: iPhone 6.9" (1320×2868)
and 6.3" (1206×2622), iPad 13" (2064×2752), Android phone (1080×1920) and tablet (1440×2560),
turned for `ui.orientation: "landscape"`; the language is `en`. Name the game's languages, and
change the rest, in a cheats file:

```ts
// src/store.cheats.ts
import { configureStoreCapture } from '@gameengine/ui/store-capture';

configureStoreCapture({
  languages: ['en', 'de', 'ja'],
  shots: [
    { id: 'iphone-6.9', width: 1320, height: 2868, scale: 3, safeArea: [0, 62, 0, 34], folder: 'iPhone' },
    { id: 'ipad-13', width: 2064, height: 2752, scale: 2, safeArea: [0, 24, 0, 20], folder: 'iPad' },
  ],
  key: 'F9', // a KeyboardEvent.code name, optional Shift+/Ctrl+/Alt+/Meta+
  folder: '~/Desktop/Store', // project-relative, or your Desktop, Pictures or Documents
  path: '{folder}/{language}/{n}.png', // each capture adds 1.png, 2.png… to the store folders
});
```

`path` takes `{stamp}`, `{n}`, `{shot}`, `{folder}` (the shot's `folder`, else its id),
`{language}`, `{width}` and `{height}`. It needs `{stamp}` or `{n}`, so no capture writes over
another, and must name its own file for every shot and language.

`freezeForCapture()`, `captureStoreScreenshots()` and `storeCaptureState()` do the same from code
(a cheat that sets a scene up and freezes it). Before each shot renders, the UI is laid out at
the shot's size and the game runs one UI frame (effects and `onUiFrame`, no time passing, no sim
step), so UI code follows the shot, and `elementRect` there measures that shot's boxes:

- **Size and safe area:** text, styles and `<Screen safeArea>` follow by themselves. UI code that positions things from the view reads `usePresentationView()` (or
  `presentationView()`) from `@gameengine/ui`, never `ViewInfo`: it is `ViewInfo` in play and the
  shot's view during a capture. Its `pointsPerUnit` turns points into UI units.
- **The game's localization:** register it, and each language's shots render in it (a game on
  the localization package's own skill (`localization`; skill `packages` says how to add it) registers its `currentLanguage` and `setLanguage`). `get` and `set` run as
  presentation, outside the sim: keep the language in module state or a signal the UI reads, not
  in a document or a resource (a write there throws).
- **What no store screenshot should show:** hide debug UI, FPS counters or dev badges in
  `onCaptureStart` and bring them back in `onCaptureEnd`. End runs whenever start did, even when
  a shot or a callback failed. Both run as presentation, like the language hook.

```ts
import { onCaptureEnd, onCaptureStart, onStoreCaptureLanguage } from '@gameengine/ui/store-capture';
onStoreCaptureLanguage({ get: () => i18n.language(), set: (language) => i18n.setLanguage(language) });
onCaptureStart(() => setDebugOverlay(false));
onCaptureEnd(() => setDebugOverlay(true));
```

Anything the UI frame does not reach stays as frozen: sim state, and layout a sim system computed
from `ViewInfo`. A folder outside the project is for desktop sessions only, and a phone dev build
has the cheat but cannot write into the project. Release builds never have it,
not even with `--cheats` (no debug protocol): the cheat says so. It is refused in a multiplayer
match (`E_BUSY`): the peers would wait on a frozen game.
