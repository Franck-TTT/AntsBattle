# Haptics: what each platform plays

## What the engine does before a platform plays

1. `play` looks the name up (a map built when the file loads) and becomes the entry's own call,
   with `tuning` filled for all three platforms. `services.calls` records that resolved call.
2. The player's setting: `services.haptics.setEnabled({ enabled })` / `isEnabled()`, answered by
   the engine and remembered across launches. While off, every call is dropped
   (`backend: 'haptics-off'`) and still resolves.
3. The repeat gap: the same kind (method + style or type) closer than 35 ms (patterns 120 ms) is
   dropped (`haptics-too-soon`), so a per-frame call cannot buzz nonstop. Different styles do not
   block each other. The same named entry (`play`) repeated within 100 ms plays once.
4. At most one haptic a frame reaches the device: a later call in the same frame plays only when
   it is stronger (selection < light/soft < medium/rigid < heavy < notification < pattern); the
   rest are dropped (`haptics-coalesced`). Fire haptics freely from cascades and combos: the
   engine keeps the device to one call a frame, and on Android the vibrator calls run off the
   game thread.
5. The platform's plugin plays it, reading only its own `tuning` key.

`haptics` is built into every Android and iOS build; no `plugins` entry is needed and
`E_PLUGIN` never fires for it.

## Platform differences

| | iOS | Android | Desktop |
|---|---|---|---|
| Impacts | `UIImpactFeedbackGenerator(style)` (kept prepared), `impactOccurred(intensity: strength)` | API 30+ with hardware-tuned effects: `EFFECT_TICK` (light, soft), `EFFECT_CLICK` (medium), `EFFECT_HEAVY_CLICK` (rigid, heavy) at strength 1; otherwise, and always below strength 1, a one-shot (light 20 ms at 100, soft 30 ms at 80, medium 35 ms at 170, rigid 25 ms at 255, heavy 50 ms at 255 of 255) with amplitude × strength and the tap shortened to 60–100 % | gamepad rumble, motors × strength |
| Selection | `UISelectionFeedbackGenerator` at 1; below 1 a Core Haptics transient at 0.5 × strength | `EFFECT_TICK`, or 12 ms at 80, scaled like impacts | short rumble |
| Notifications | `UINotificationFeedbackGenerator` at 1; below 1 Core Haptics transients (two taps, three for error) × strength | waveforms: two taps (success, warning), three (error), amplitudes × strength | rumble taps |
| Patterns | Core Haptics continuous events, intensity × strength; nothing without Core Haptics | waveform, amplitude = intensity × strength × 255 | rumble per pulse |
| No hardware support | iPads and old phones: generators do nothing, Core Haptics is absent (`supported()` false) | no amplitude control: fixed amplitude, so strength only shortens taps (0 still silences); no vibrator: nothing, logged once | no pad: nothing; the editor and `gameengine test` only record calls (mock) |
