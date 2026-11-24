---
name: ui-mvc-views
version: 1.50.0
tier: required
description: Game UI views and controllers — defineView placing a UI document, a controller filling its model from the world, intents, the view stack and its camera order, UI animation, sprites, pooled scrolling lists, text, models and rigs in views, the Unity UI mapping. Use for the code side of any HUD, menu or popup (its looks are ui-documents).
---

# UI: views, controllers, intents

## The rules that matter most

1. **Views never touch the world or services; controllers never build UI.** That split is what makes views previewable and testable.
2. **New screens, popups and widgets are UI documents** (skill `ui-documents`); a view places a document and fills its model. TSX is for what documents cannot hold.
3. **Every state a view can be in gets a sample**, and every view holds from 9:22 phones to 3:4 tablets (skill `screen-fit`).
4. **UI motion is CSS played natively**, never JS per frame and never in sim systems.
5. **Never pool UI by hiding it**; use `<Pooled>`.

**View** (`src/views/<name>.view.tsx`): shows only its model, raises intents, has samples. Its looks are a UI
document (skill `ui-documents`): the view places it, fills its properties from the model and maps its events.

```tsx
export const HudView = defineView<{ score: number; movesLeft: number }>({
  name: 'Hud',
  description: 'Score and moves. Intents: pause.',
  samples: { start: { score: 0, movesLeft: 20 }, lastMove: { score: 2980, movesLeft: 1 } },
  render: (model, { intent }) => (
    <Screen safeArea class="hud"><View class="a-top">
      <Widget doc="hud-bar" class="hud-bar" props={{ score: () => model().score, moves: () => model().movesLeft }}
        onIntent={(_, e) => intent(e.path.at(-1)!)} />   {/* the document's pause button sends `pause` */}
    </View></Screen>
  ),
});
```

A TSX-only view writes the same render with `<Text>`, `<Button>`, `<Sprite>` and classes from `ui/*.style.css`;
keep that for what documents cannot hold (below).

**Controller** (`src/ui/*.tsx`, in `defineUI`): reads the world, pushes views, turns intents into sim events.

```ts
const score = useResource(Score);
const hud = views.push(HudView, untrack(() => ({ score: score().value, movesLeft: 20 })), {
  onIntent: (name) => name === 'pause' && emit(PauseRequested, { paused: true }),
});
createEffect(() => hud.update({ score: score().value, movesLeft: 20 }));
```

- `useResource(T)` subscribes **per field**: it returns a live, read-only record, and an effect re-runs only when a field it read changed. A HUD reading `board().phase` does not re-run when `board().timer` moves every step, so a resource that changes every step needs no separate presentation-only copy. Keep a snapshot with `{ ...board() }` (the record itself always reads current values); it is `null` while the resource does not exist. `untrack(board)` returns the live record, whose field reads still subscribe: read untracked fields inside the callback, `untrack(() => board().phase)` or `untrack(() => ({ ...score() }))`.
- `useDoc(doc)` does the same for a world document or a `metaInWorld` handle (`useDoc(shopState)`): it re-runs when the document's version changes and returns the same frozen value until then.
- What the UI still costs per frame, for all `defineUI` systems together (the first to run in a frame refreshes for all): one host call for every tracked resource's change tick, one for input (`ui.poll`), one to send queued node ops when there are any, and one per `useDoc` document (its version). A resource whose tick moved is read once (one host call) and compared field by field; only effects of changed fields run, and only changed props queue ops.
- Styles go in `ui/*.style.css` (classes, `@media (aspect > 0.7)`); prefix a view's classes with its name.
- Every state a view can be in gets a sample. Check: `gameengine view render Hud --sample lastMove --out hud.png` (`--model '<json>'` for any other state, `--size 393x852 --safe 0,59,0,34` for a device; MCP `view_render`).
- Check a layout on a slim and a wide screen in one call: `gameengine view render Hud --sample lastMove --devices` renders it on `pixel-8` (20:9) and `ipad-10` (4:3), each with its own size, scale and safe area, side by side (stacked with `--landscape`); `--devices iphone-se,galaxy-tab-s9` picks others. `--json` (and MCP `view_render` with `devices`) gives each device's rect in the sheet.
- Every view must hold from 9:22 phones to 3:4 tablets: flex bars instead of fixed `top`, `text-fit` on labels, `max-width` on tablets. Skill `screen-fit` has the rules and the device table.
- In the editor, the **UI** mode is the visual UI editor: it edits documents, not TSX. Selecting a `*.view.tsx` in the Project panel previews that view from its first sample in the inspector. Keep TSX positions (placing documents in the view's anchors included) in `ui/*.style.css`, not inline `style` props.
- Popups stack: `views.push` returns a handle with `update` and `close`.
- **Dialogs dim with the stack's scrim:** never draw a backdrop in a view. `defineView({ dims: true, blockInput: true, … })` (or `views.push(V, m, { dims: true })`) asks the stack to draw its one scrim just under the view: the project's `ui.scrim` (`{ "color": "#05070d", "opacity": 0.6, "ms": 220 }` in `project.gameengine.json`). `"blur": 10` also blurs the game behind it (pixels at the reference size; the UI drawn after the scrim stays sharp). The blur costs a few quarter-size passes while a dialog is up, so it is off on phone-low unless a quality level turns `uiBackdropBlur` on; there the scrim only dims. Any element can do the same with the style `backdrop-blur: 12px` (the first one in a frame; it blurs the game and UI drawn before it, inside the element's box, faded with its opacity). A second dimming dialog takes the scrim, and it moves back once that one is gone; it fades in with the first and out with the last one's exit. UI documents of kind `view` (`<Widget doc="no-lives" />` as a view's whole render) bring their own behaviour: Enter / Exit poses, screens that cover and uncover, and `tapOutside: dismiss` sending a `dismiss` intent.
- **Code areas put your TSX inside a UI document:** `<Widget doc="art-quit" codeAreas={{ 'quit.content': <Text>…</Text> }} />` fills a document's empty `codeArea` box; what you pass stays yours across reloads (skill `ui-documents`).
- **Layers:** views draw by layer — `screen` (default), then `overlay` (toasts, banners) — and in push order within a layer. Dialogs and popups are screens: a screen a dialog opens draws over it. Set the layer on the view (`defineView({ layer: 'overlay' })`) or per push (`views.push(V, m, { layer: 'overlay' })`). A loading cover (`loading.run`/`loading.boot`) draws above every layer: a HUD or menu pushed while it is up (or in the same frame, after it) lands under it. `views.pop()` and `views.clear()` leave the cover (and the cheat console, also on top) to their owners; `views.top()` still names them while they are up (`gameengine.LoadingView`, `gameengine.CheatConsole`: the engine's views are named `gameengine.*`, a prefix your view files cannot use, and a view name defined in two files is refused). `views.pushBelow(cover, V, m)` puts `V` on top of its own layer, under the cover. A `defineUI` root element mounted while a cover is up also goes under it. To start a level in place, clear the old views and push the new ones in `loading.run({ onCovered })` (skill `asset-memory`).
- **Camera order (Unity's Screen Space - Camera canvas):** `views.push(V, m, { order: 0 })` or `defineView({ order })`
  puts a view among the cameras: it draws after every camera whose `Camera.order` is at most its own and before the
  rest, so a camera ordered above it (a lift camera drawing a picked-up piece) draws over it. A view without `order`
  draws over every camera, as an Overlay canvas does: keep the HUD unordered. Ordered views draw first, ascending,
  then the rest by layer and push order; `pushBelow` takes the target's order. Presses on an ordered view go to the
  game where a sprite a camera above it drew covers the point. A view under a 2D lift camera draws after post at native
  resolution as usual; under a camera that clears or draws 3D it draws into the scene (post, render scale). A `screen` document pushed without order over an ordered screen
  covers it: make the unordered one an `overlay`. Cameras, `layerMask` and the "from Unity" table: skill `camera`,
  "A camera between UI views"; `<WorldSlot>` there too, for a camera between two elements of one view.
- **Lift an element through a tutorial dim (Unity: `SetParent` onto the tutorial canvas):** any element takes
  `lift="TutorialDim"` (a view name: just above the topmost open view of that name, under the views drawn after it),
  `lift={20}` (a camera order) or `lift={null}`, reactive as `lift={() => step() === 1 ? 'TutorialDim' : null}`. It
  draws there with all its children, including what spills out of its box, and takes the presses there first; give it
  `pointer-events: none` and a press on it is the dim's. It stays in its own view: layout, model, animations, and the
  position, scale and opacity its parents give it, so nothing is copied or rebuilt; only its parents' `overflow: hidden`
  stops cutting it. When that view closes it drops back by itself; a view that is not open draws it in place (a dev
  warning), and so does a lift on a view's own root. `<Widget doc="…" lift={…}>` lifts a placed document the same way.
  Keep the tutorial's hand and text in the dim view (Unity's one tutorial canvas): put `<LiftSlot />` in the dim after
  its backdrop and before the hand, and what is lifted over the dim draws (and takes presses) at the slot, under the
  hand. Without a slot it draws above the whole dim. Never cut holes in a dim, copy the element into the tutorial view
  or split the dim and the hand into two views. In a UI document, `lift` names a text or number property, `pointerEvents`
  a yes/no property that lets presses through while no (Unity's `ToggleButton(false)` on a lifted button), and an
  element's `liftSlot` marks a slot (skill `ui-documents`). `ui.layout`, `ui.hit` and the editor's Views hierarchy show
  `lift: { target, lifted, order, over, slot }`. Costs no pass; the dim stays one draw. Example: `samples/ui-gallery`
  `src/views/spotlight.view.tsx`.
- Button feedback for the whole project goes in `project.gameengine.json`, not on every button:
  `"ui": { "button": { "haptic": "light", "hapticOn": "click", "sound": { "guid": "<tap.wav's .gmeta guid>" }, "volume": 0.8 } }`
  (the project file names the sound by reference; `gameengine refs which` checks a GUID, and a path
  written there still loads until `gameengine refs migrate` rewrites it).
  A button's own `haptic` / `sound` wins (`null` opts out); `sound={{ src: 'audio/buy', volume: 0.5 }}` sets a volume;
  the sound plays on the UI bus as presentation (`audio.play`): it never reaches the sim, a replay or the hash, and a
  test sees it in `audio.sounds()`;
  `hapticOn: 'click'` plays on the completed tap as Unity's `onClick` does (default `press`: touch-down).
  `haptic` takes a preset or a `haptics.json` entry name tuned per platform (skill `haptics`).
- An `emit` while the UI first mounts (the root or its first effect run) reaches the sim on the next step.

## Lists, pooled lists and what UI costs

What a frame costs is the **shown** UI that **changed**: a change restyles the changed node and its subtree, and relays out only what Taffy sees change; a frame with no UI change does no styling or layout. `display: none` subtrees and detached nodes cost nothing per frame (only memory). So:

- `<For each={() => items()}>{(item, i) => …}</For>` builds an item's UI when it arrives and destroys it when it leaves; items that stay are not touched.
- `<Pooled each={() => flights()} warm={{ count: 30, item: idle }} max={64} name="flights">{(f, i) => <Flight f={f()} />}</Pooled>` parks the UI of items that leave (detached) and hands it to the next item that comes: `item` and `index` are accessors, so read `f()` inside reactive props. A reused or first-shown UI replays its CSS animations as a new element does, and does not transition from its old style. Use it for UI that comes and goes many times a second (flying icons, floating texts, hit numbers); `warm` builds item UIs up front (during a loading screen), `max` caps the idle ones kept. `uiPoolStats()` gives `active`, `idle`, `peak`, `created` and `dropped` per list: set `warm` to the `peak` of your busiest level.
- **Never pool UI by hiding it** (`display: none` / `opacity: 0` slots that are shown by a class): it works, but every per-item effect keeps running. Unmount it, or use `<Pooled>`.
- A node shown again after `display: none`, or inserted again after a detach, replays its CSS animations (as in a browser).
- **Scrolling lists** (`<ScrollView>`, virtual rows, snapping, `onScroll`): `references/tsx-elements.md`.
- **Handlers get the pointer:** `onPress`, `onPressIn`, `onPressOut` receive `{ x, y, dx, dy }` (view px, as `ui.rect`: where the pointer is and how far it moved since the press began); `() => …` handlers keep working. `onDrag={(e) => …}` fires on every move while the element is held (a slider, a drag handle); a ScrollView around it leaves its drags to it. `onScroll` gets the new offset (`x`, `y`) and the change (`dx`, `dy`). Every pointer event has `phase` (`'down'`, `'move'`, `'enter'`, `'leave'`, `'up'`, `'cancel'`); `onPressOut` fires when the held pointer leaves too, so a virtual joystick resets in `onPointerUp`, which fires once when the pointer that pressed the element lifts or is cancelled, wherever it is then.
- **What a node draws:** `gameengine ui layout [<id>]` prints the tree with each node's screen box after transforms, scroll and clipping (`hidden` when it is off screen or transparent), opacity, text size and line count, `OVERFLOWS` when text is larger than its box (cut off, or spilling out: no ellipsis is drawn), and scroll offsets; `--json` (MCP `ui_layout`, protocol `ui.layout`) adds a style summary per node.
- **Node budget:** `gameengine check` lays the UI out during its smoke run and reports the most nodes shown at once (`ui nodes`); above 1000 it warns, and `check.smoke.uiNodes` in `project.gameengine.json` makes a budget it fails on. Rough guide per device class: phone-low 600, phone 1200, tablet 2000 shown nodes. Profile with `gameengine run --headless --ui-layout` and `perf.stats` / `profile.markers` (`ui.cascade`, `ui.layout`, `ui.paint` markers with node counts).

## Views and UI documents

New screens, popups and widgets are **UI documents** (`ui/**/*.ui.json`) that people tune in the editor's UI
mode; the view places them and keeps the model, intents and motion. Skill `ui-documents` covers
building them with `gameengine ui doc` (widgets, properties, states and poses, lists, dialogs) and placing them
(`<Widget doc props onIntent refs codeAreas>`, `src/ui.gen.ts`). The rest of this skill is the view side, and
the TSX for what documents do not hold: particles, models, skeletons and pooled lists (in a
document's code area), per-aspect layout, and views that are mostly those. Port older TSX views with the
`ui-views-to-documents` skill.

## Animation

UI motion is CSS played natively over UI time (presentation: no JS per frame, never in sim systems).
Reach for the built-in effects first; every project has them, below its own stylesheets.
Script motion CSS cannot express (a count-up, a popup queue's timer) goes in `onUiFrame((now) => …)` from `@gameengine/ui`:
it runs once per UI frame with UI time in seconds until you call the stop it returns, and costs nothing while none is set.
When several effects feed one view in a frame (a placement updates the board, the score and the goals), updating the view from each renders it once per effect.
Note the change in the effects and apply it from `onUiFrameEnd(() => …)`: it runs once per UI frame after the frame's effects and before its ops go to the engine, so the view renders once and shows it in the same frame (from `onUiFrame` it would land a frame late).
It runs until you call the stop it returns, whoever registered it: in a view or a popup's controller, `onCleanup(onUiFrameEnd(…))`. A change noted by an effect the hook's own writes trigger waits for the next frame's hook.

| Enter | Exit | Attention (once) | Loops |
|---|---|---|---|
| `fx-pop-in` `fx-fade-in` `fx-scale-in` `fx-slide-in-up/down/left/right` | `fx-pop-out` `fx-fade-out` `fx-slide-out-up/down/left/right` | `fx-bounce` `fx-shake` `fx-wiggle` `fx-attention` `fx-pop` `fx-pulse` | `fx-pulse-loop` `fx-glow-loop` `fx-heartbeat` |

Tune per element: `--fx-duration` (`0.5s`), `--fx-delay`, `--fx-strength` (1 = normal, 2 = bigger), `--fx-distance` (slides, px).

```tsx
// A view that pops in, fades out and is modal: defaults for every push.
export const Reward = defineView<RewardModel>({ name: 'Reward', samples, enter: 'fx-pop-in', exit: 'fx-fade-out', blockInput: true, render });
views.push(Reward, model, { enter: 'fx-slide-in-up' }); // override per push; `null` = none
views.pop();                                             // leaves the stack now, nodes go after the exit
// A view placing a view document plays the document's Enter / Exit instead, keyed tracks, staggers and
// its tap lock (`lockInput`) included (skill ui-documents): keep a popup's animation there, not in code.
// A looping CTA and stars that land one after another, all in TSX/CSS:
<Button class="collect fx-pulse-loop" label="Collect" onPress={() => intent('collect')} />
{[0, 1, 2].map((i) => <Sprite src="ui/star" class="star fx-pop-in" style={{ '--fx-delay': `${0.25 + i * 0.12}s` }} />)}
<Text animateOnChange={{ effect: 'fx-pop', strength: 1.5 }}>{() => model().coins}</Text>
```

From controllers (Web Animations shape, ms): `ui.animate(ref, 'fx-bounce', { duration, delay, iterations, easing, strength })`
→ `{ finished: Promise<boolean>, cancel, pause, play, finish }`; `ui.stagger(parentRef | refs, 'fx-slide-in-left', { each: 40, from: 'start' | 'end' | 'center' })`.
Get refs with `ref={(n) => (node = n)}`. `finished` never rejects (false when cancelled or removed).

Your own motion is plain CSS (`@keyframes`, `animation`, `transition`); what is supported: `references/css-animation.md`.

- Reduced motion is honoured for you (`ui.setReducedMotion(true)` from a settings toggle, `ui.reducedMotion` in
  `project.gameengine.json`): motion is dropped, enters/exits become short fades. Style extra cases with
  `@media (prefers-reduced-motion: reduce)`.
- Check it without a device: `gameengine view render Reward --times 0,0.1,0.2,0.4 --out reward.png` writes a contact sheet
  (enter from t=0); `--phase exit` samples the exit instead, from the pop of the view at rest (its enter and CSS animations
  ended). `--json` reports `span`, the transition's length without loops, to pick times from. UI Preview in the editor has
  Replay, Pause and a scrubber.
- In tests, UI time advances by the fixed step: `const f = ui.animate(n, 'fx-bounce').finished`, set a flag in `.then`,
  `await step(n)` (world tests may only await `step`), and a `renderTest` screenshot at a fixed step is a stable golden.

## Flying an icon to a counter

Coins, gems, lives and items flying onto a counter or button go through `ui.animateTo`, never hand-written keyframes:

```tsx
// Pooled icons (see Lists), launched from the reward, onto the chip's `target` point.
await ui.animateTo(icons, {
  from: 'reward.icon',                    // default: where each icon is
  to: ['coins.target', 'play'],           // the counter's icon, then a fallback when it is not shown
  land: 'target-size',                    // or a scale factor
  stagger: 70, duration: 720, arc: 0.25, easing: 'in-out-sine',
  onLand: (i) => { setShown((n) => n + perIcon); if (i === 0) ui.animate(chipRef, 'fx-bounce'); },
});
```

- **Measure in screen space.** Both ends are measured with `drawnRect` as the icons launch: the box drawn after every
  ancestor's transform, scroll and clip (the numbers `gameengine ui layout` prints). `elementRect` is the layout box
  without transforms: anything under a scaled or moved ancestor is elsewhere on screen, so never aim at it.
- **Aim at the target's icon**, not the whole button or capsule: give the document a point (`target`, skill
  `ui-documents`) or the icon an id. Never type in screen positions.
- **Land at the target's size** (`land: 'target-size'`) and **declare a fallback** for when the counter is not shown
  (another screen covers it): the first id in `to` that is shown wins. With none shown it logs a warning and nothing
  moves, never a silent fade.
- **Prove it lands:** render the last frame on the narrowest and widest device (`view render <View> --devices --times
  end`: every animation and flight at its end), and add a renderTest on both that ends the flight with
  `ui.finishAnimations()` and checks `expect(icon).toLandOn('coins.target')` (centres within 2 px, where both are
  drawn; `samples/ui-gallery` `tests/animate-to.test.tsx`).
- **Layout numbers live in CSS.** A count or spacing that changes with the screen (columns, a gap, a breakpoint) is a
  custom property in a media query, read with `ui.cssVar('grid', '--cols')`, never a second copy of the breakpoint
  in script.
- **A game item flying onto the HUD** (a cleared piece, a collected item) stays in the world: put it on the
  layer a camera ordered above the bar it crosses draws (`RenderLayers`; skill `camera`, "A camera between UI
  views") and move it there. Use `ui.animateTo` for UI icons, never to copy a world item into the UI.

## Particles, 3D models, skeletons and flipbooks in views

`<Particles>`, `<Model>`, `<Skeleton>` and `<Flipbook>` are elements: they draw in tree order and scale with the UI. Props, examples and the Unity UIParticle mapping: `references/tsx-elements.md`.

## 9-slice and Unity ports

Borders go on the texture once, in its `.gmeta` (`[settings] border`), and elements use `auto`; round art rules are in skill `ui-documents`. The full 9-slice rules, Unity's layout groups and the Image/Canvas mapping table: `references/unity-ui.md`.
