---
name: haptics
version: 1.2.0
tier: optional
description: Haptics and vibration — haptics.json entries per platform, services.haptics.*, Button haptic=, the player's setting, the Haptics mode, E_HAPTICS. Use when adding or tuning a vibration, tap, rumble or game-feel feedback, when it feels wrong on iPhone or Android, or when porting Unity haptics.
---

# Haptics

Haptics are presentation: call them from UI controllers, views and `LateUpdate` code, never from
a sim system (service calls throw in sim). A sim event ("MatchCleared") that presentation reacts
to is the usual shape.

## Name every haptic in `haptics.json`

The same effect feels different per platform: an iPhone's Taptic Engine plays a crisp, strong
tap, most Android motors a weaker, buzzier one. So each action gets a named entry, beside
`project.gameengine.json`, with a strength per platform:

```json
{
  "$schemaVersion": 1,
  "entries": {
    "match": { "effect": "impact", "style": "light", "note": "A plain match clears",
               "ios": { "strength": 0.7 }, "android": { "strength": 1, "style": "medium" } },
    "pick":  { "effect": "selection", "ios": { "strength": 0.8 } },
    "win":   { "effect": "notification", "type": "success" },
    "roll":  { "effect": "pattern", "note": "Long cascade",
               "pulses": [{ "atMs": 0, "durationMs": 40, "intensity": 0.4 }, { "atMs": 70, "durationMs": 40, "intensity": 0.8 }],
               "android": { "strength": 1 }, "ios": { "strength": 0.75 } }
  }
}
```

- `effect`: `impact` + `style` (`light` `medium` `heavy` `soft` `rigid`), `notification` + `type`
  (`success` `warning` `error`), `selection`, or `pattern` + `pulses` (1–32; `atMs` 0–10000,
  `durationMs` 1–5000, `intensity` 0–1). `note` is for people.
- Per platform (`ios`, `android`, `desktop`): `strength` 0–1 (1 = the platform's default feel,
  0 = nothing) and, on impacts only, `style` to play another style there. A platform left out
  plays strength 1 and the base style.
- Names start with a letter (letters, digits, `_ . -`, at most 64) and are never a preset name
  (`selection light medium heavy soft rigid success warning error`), because `haptic=` takes both.
- `gameengine validate` / `check` report mistakes as `E_HAPTICS` with the path
  (`entries.match.android.strength: must be a number from 0 to 1`); unknown keys are errors.
- The running game reloads the file when it changes (editor save, undo, an agent's edit).

## Playing them

```ts
import { services } from '@gameengine/runtime';
const buzz = (name: string) => void services.haptics.play({ name }).catch(() => undefined);
buzz('match');
```

```tsx
<Button id="pause" icon="ui/pause" haptic="button" onPress={() => intent('pause')} />
```

- `haptic=` on any pressable element (plays on press-down; `hapticOn="click"` on the completed
  tap) and `ui.button.haptic` in `project.gameengine.json` take an entry name or a preset.
- Presets and direct calls: `impact({ style })`, `notification({ type })`,
  `selection()`, `pattern({ pulses })`. They play strength 1 everywhere unless you pass
  `tuning: { ios: { strength: 0.7 }, android: { strength: 1, style: 'medium' } }` yourself;
  prefer an entry, which designers can tune without a code change.
- An unknown name rejects with `E_HAPTICS` (logged once). Catch rejections: haptics never matter
  to game logic.
- `services.haptics.supported()` → `{ haptics, patterns }`: hide the settings toggle where
  `haptics` is false.

## Platform differences

Each preset and entry maps to the platform's own pattern (iOS feedback generators and Core Haptics, Android vibration effects; desktop plays nothing). The exact mapping and what the engine checks before a platform plays: `references/platforms.md`.

- Android's default is the Vibrator as game usage, so the phone's "touch feedback" setting does not
  mute it. `"services": { "haptics": { "android": { "mode": "view" } } }` in
  `project.gameengine.json` plays the view's haptic feedback instead: the system's effect, silenced
  by that setting, faint on many phones, and it cannot scale (it plays unless strength is 0).
- Rule of thumb: start Android at 1 and iOS at 0.6–0.8 for taps a player feels often; use an
  Android `style` one step heavier when a light tap disappears on mid-range phones. Only real
  devices can confirm it.

## Tuning in the editor

Mode picker → **Haptics** (off by default: the user switches it on in the picker's Library): one row per entry with the effect, an iOS and an Android strength
slider (0–1, step 0.05) with a style override for impacts, add / rename / delete, and a play
button that sends `haptics.play` to the running game (Play mode) or the editor's scene session.
On a desktop session that is a mock (the status line says `played on: mock`); on a dev build on a
phone you feel it. Saves go through the command bus: undo works and the running game reloads the
file. Agents edit the same JSON; `gameengine validate` checks it.

## Testing

```ts
worldTest('a match plays the match entry, tuned per platform', async ({ step, services }) => {
  // … make a match …
  const p = services.calls('haptics.impact')[0]!.params as { style: string; tuning: Record<string, { strength: number; style?: string }> };
  expect(p.tuning.ios).toEqual({ strength: 0.7 });
  expect(p.tuning.android).toEqual({ strength: 1, style: 'medium' });
});
```

- Tests can prove: which entry played and when, each platform's resolved strength and style, the
  off switch, repeat gap and coalescing (`backend`: `haptics-off`, `haptics-too-soon`,
  `haptics-coalesced`), `E_HAPTICS`, and a build without the plugin
  (`services.mock('haptics.*', { error: 'E_UNAVAILABLE: …' })`; `setEnabled` / `isEnabled` keep
  answering). Each test starts with haptics on and no repeat history.
- Tests cannot prove how it feels. Strength, style and patterns must be felt on at least one
  iPhone and one mid-range Android phone.

## Checklist

- [ ] Every haptic the game plays is a named entry (`play` / `haptic="name"`), not an inline preset.
- [ ] iOS and Android strengths are set for each entry and felt on real devices.
- [ ] Calls come from presentation code and swallow rejections.
- [ ] The settings screen has a haptics toggle bound to `setEnabled` / `isEnabled`, hidden when
      `supported().haptics` is false.
- [ ] `gameengine check` passes (no `E_HAPTICS`), and a game test asserts the entries it relies on.
