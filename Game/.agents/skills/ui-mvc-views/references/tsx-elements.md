# TSX elements: scrolling lists, particles, models, skeletons, flipbooks

## Scrolling lists

- **Scrolling lists:** `<ScrollView id="levels" class="levels" contentClass="level-rows" onScroll={(e) => …}>{rows}</ScrollView>` (CSS `overflow: scroll`, or `overflow-y` / `overflow-x`). Give it a size (`height`, or `flex-grow: 1` in a column); its children sit in a content container (`contentClass` for `padding` / `gap`) that grows with them, and `horizontal` lays them out in a row. `scrollTo` sets where it opens: `'end'`, `'start'`, or `{ id: 'card-2', align: 'center' }` (`align` `start` by default) puts that descendant at the start, centre or end of the list's box, clamped to the content. It holds until the player scrolls: every layout places it again (fonts and images arriving, another view size, rows added later). After that the same value on a re-render leaves the player's offset, and a new value moves it again, stopping a fling or bounce. On a `scroll-snap` list it rests on the nearest snap point or end. `{ to: 'end', duration: 250, easing: 'expr(2 * t - t * t)', follow: true }` glides there instead (easing as `ui.animate` takes it), and `follow` goes back each time the content grows, even after the player scrolled away: a chat keeps its newest line in view with one constant value. A drag, fling or wheel stops a glide; taps land where rows are drawn. A drag scrolls it once it moves past about 2 mm (30 reference px): the Button it started on gets `pressOut` and no `press`, so dragging a list never taps a row; a release flings it, a touch stops a fling (and taps nothing), and the mouse wheel scrolls the list under the mouse on desktop. The offset is presentation (never in the sim or replays); rows scrolled out of view draw nothing, and `ui.rect`, `ui.press`, `ui.interactables` follow the scroll. `scroll-snap: <length> | pages | children` settles a released list on the row (or page, or child of any size) nearest where its fling would stop, at least the next one; `scroll-snap-align: center` rests rows centred, `scroll-snap-stop: always` moves one at most per swipe (a pager), and `scroll-snap-threshold: 33%` makes it turn only past that share of the way or on a flick (a swipeable tab pager); `overscroll: bounce` stretches it past an edge like rubber, and a fling into an edge carries past it further the harder it was flung, then springs back. Hear the motion with `onScrollBegin`, `onScrollEnd` (at rest), `onFling` (`e.toY`: where it will stop), `onSnap` (`e.index`: the row it lands on, for a page dot) and `onOverscroll` (`e.edge`, `e.stretch`: a pull-to-refresh); `snapHaptic="selection"` ticks once per new snap point. Drive it from code with `handle={(h) => (list = h)}`: `list.state()` (offset `x`/`y`, speed `vx`/`vy` per second, range `maxX`/`maxY`, `moving`; reference px), `list.stop()`, `list.by(0, 300, { animated: true })`, `list.page(1)` (a pager's Next) and `list.fling(0, -4000)` (back to top with a natural throw); they run on the list's own motion, so it still snaps and reports `onSnap`. `scrollbar: auto` shows a thin position indicator while it moves (`always` keeps it; `scrollbar-color`, `scrollbar-width`). Tune the feel once at the root (inherited) or per list: `scroll-feel: default | soft | snappy | bouncy`, or `overscroll-strength: 1.5` (0: a fling stops dead at the edge), `overscroll-max: 40%`, `overscroll-spring: spring(0.6s, 0.2)` (swing period, bounce 0 = no overshoot), `scroll-snap-spring: spring(0.3s)` and `scroll-deceleration: slow | normal | fast | <rate>` (per second, 0.1–50; `normal` = 3); a UI document's scroll block takes them as `feel`. `clip-softness: 0 100px` (`<x> <y>`, or one length for all four edges) fades the rows to transparent over that far inside the list's top and bottom edges as they scroll out, instead of cutting them (Unity's `RectMask2D.softness`); a card with `overflow: hidden` inside a fading edge fades with it. Long lists: rows still exist as nodes, so past a few hundred use `<Pooled>` inside it and keep the node budget below (a UI document's Repeat in a scroll element is virtual: only the rows in view exist).

## Particles, 3D models and 2D skeletons in views

All three are elements: they draw in **tree order** (siblings before them behind, after them in front), scale with the canvas
and are clipped by an `overflow: hidden` parent, like a Sprite. Size and place their box with CSS.

```tsx
<View class="medal">                                     {/* overflow: hidden clips the glow */}
  <Particles class="glow" effect="vfx/shine.vfx.json" />  {/* behind the coin */}
  <Model class="coin" mesh="builtin:torus" material="ui/coin.mat.json" rotation={[90, 0, 0]} spin={120} bob={[0.06, 1.6]} />
</View>
<Particles class="confetti" effect="vfx/confetti.vfx.json" restart={() => model().opened} />  {/* last: in front */}
<Model mesh={item.mesh} color={item.color} rotation={[20, 35, 0]} />  {/* a still list item: renders once */}
<Model class="portrait" mesh="models/hero/Hero.fbx" animation={() => `models/hero/Hero@${model().line}.fbx#${model().line}`}
  loop={false} mix={0.2} queue={{ animation: 'models/hero/Hero@Idle.fbx#Idle', mix: 0.3 }} restart={() => model().lines}
  camera={{ fov: 30, distance: 0.6, pitch: 0, target: [0, 1.6, 0] }} onFinish={() => intent('lineDone')} />  {/* a talking head */}
<Skeleton class="cat" skeleton="rig/cat.skeleton2d.json" animation={() => model().mood} mix={0.25}
  queue={() => (model().mood === 'cheer' ? 'idle' : null)} restart={() => model().cheers} skin={() => model().skin} />
```

- `Particles`: `effect` (a `*.vfx.json`, see the `vfx` skill), `emitting` (false stops, live particles finish; true again
  restarts), `restart` (a new value replays the effect from the start: put a counter in the model and bump it from the
  controller or an intent), `unit` (reference px per effect unit, default 100), `seed`. Emits from the box's centre.
- `Model`: `mesh`, `material`, `color`, `rotation` (Euler degrees), `spin` (deg/s about Y, or `[x, y, z]`), `bob`
  (`amplitude` or `[amplitude, seconds]`), `scale`, `camera: { fov, distance, pitch, yaw }`, `light: { direction, color,
  intensity, ambient }`. Rendered into a shared render-target page and drawn as a sprite; it renders again only when a
  prop or its pose changes. `spin`/`bob` re-render it every frame: keep them to the item in focus in long lists, and pin it
  in a test with `render.stats().uiModelsRendered`. `camera.target` (`[x, y, z]`, model units after `scale`) is the point
  the camera orbits and looks at: frame a head on a full-body model with it and a short `distance` (a Unity porthole's
  orthographic size `s` at model scale `k` is about `distance = s / k / tan(fov / 2)` with `target` at the head).
- **Clips on a skinned `Model`** (the `models-3d` skill imports them): `animation` (`file#clip`, e.g. Unity's
  `Hero@Talk.fbx#Talk`, or a clip of the mesh's own file; a changed name plays it, cross-fading over `mix` seconds;
  `null` is the bind pose), `loop` (default true), `queue` (`'Idle'`, or `{ animation, loop, mix }`: what follows a
  one-shot, starting `mix` seconds before its end), `restart` (a counter: replays `animation`), `timeScale` and `speed`
  (multiplied; 0 holds the pose) and `onFinish()` (a one-shot `animation` reached its end, once per play; a clip that
  is not in the file plays nothing and never finishes; the UI warns once in the console). The clip plays
  on **UI time** in the host and poses through the world's skinning code (joints matched by name, as `*.animctrl.json`
  clips): no `Animator`, no hash, and a contact sheet shows the pose at each time. A playing clip renders every frame; a
  finished one-shot without a queue, or `timeScale: 0`, renders once. One clip at a time with one cross-fade: blend
  trees, layers, masks and IK stay on a world `Animator`. `overflow: hidden` clips to a rectangle; for a shape, put
  `mask-image: url("<image>")` on an element around the model: it and everything in it draw only where that image is
  opaque, stretched over its box (a portrait whose rig leaves the frame above but is cut by its round bottom).
- `Skeleton` (a `*.skeleton2d.json`, see the `skeleton-2d` skill): the same play/queue/mix API as `Skeleton2D`, as props.
  `animation` (a changed name plays it on the base track, cross-fading over `mix` seconds), `loop` (default true),
  `queue` (`'idle'`, or `{ animation, loop, additive, mix, delay }`: what follows when it ends), `restart` (a new value plays
  `animation` again: a counter for a one-shot that is already the current name), `timeScale`, `layers` (tracks 1–7 over the
  base: `[{ animation: 'blink', alpha, loop, additive, mix, queue, timeScale, restart }]`; `additive` adds the layer's bone
  offsets to the base instead of replacing them), `skin`, `speed` (every track; 0 holds
  the pose), `color`, `flip` (`'x' | 'y' | 'both'`), `scale` (zoom) and `bounds` (`[minX, minY, maxX, maxY]` skeleton px
  to fit into the box; default the setup pose's, so pass it when an animation reaches past the setup pose). It plays on
  **UI time** in the host, never in the sim: no `Skeleton2DEvent`s, no hash, no entity; a seek or contact sheet shows the
  pose at that time. An opaque, unrotated skeleton under no clip and without physics draws straight in the UI pass, in
  its paint order and cut at its box (no cell, so not in `uiModelsRendered`). Any other one renders into the same page as
  `Model`s: playing, every frame; paused or finished, once (`render.stats().uiModelsRendered`). All of a frame's playing
  cells share one offscreen pass (`uiCellPasses`), and one faded to opacity 0, off screen or outside its clip is not rendered. Game logic that reacts to a character's animation events stays a
  world `Skeleton2D`.
- `Flipbook` (a `*.clip2d.json`, see the `flipbook-2d` skill): `clip`, `playing` (false holds the frame), `loop`
  (`'asset' | 'once' | 'loop' | 'pingpong'`), `speed`, `restart` (a counter: replays from the start), `color`, `flip`,
  `onEvent(e)` (the clip's frame events: `e.name`, `e.frame`, `e.int`, …) and `onFinish()` (a `once` clip ended; it
  holds its last frame). The frame's sprite is stretched over the box: size it to the frames' aspect in CSS. Keyed
  `offset` moves it in box sizes. It draws as a plain batched sprite (no render target), so lists of animated icons are
  cheap. UI time, presentation only: game rules keyed to frames stay on a world `Clip2D`. Events fire on rendered
  frames (test them in a `renderTest` that calls `render.stats`, as `samples/rig-yard/tests/flipbook-view.test.ts`);
  a looping clip shown after being hidden reports at most its last cycle.
- **CSS sprites vs UI particles:** a few hand-placed sprites that pop, pulse or slide → `fx-*` / `@keyframes` on a
  `Sprite` (exact, art-directed). Many randomised bits (confetti, sparkles, coin bursts, glints) or an effect that already
  exists as `.vfx.json` → `<Particles>`. Anything in the game scene → a world `ParticleSystem`, not the UI.
- Both preview, scrub and render as contact sheets like the rest of the view (UI time), and `renderTest` goldens are stable.
- Unity ports: a `ParticleSystem` under a Canvas (UIParticle, Coffee.UIExtensions) → `<Particles>` with the converted
  effect; a `RawImage` showing a `RenderTexture` from a 3D preview camera → `<Model>` (an `Animator` playing the
  character's `model@clip.fbx` takes → `animation`/`queue` props, the camera's framing → `camera.target`/`distance`); a Spine `SkeletonGraphic` (a HUD
  character, a menu icon) → `<Skeleton>` with the imported rig (`spine-import`), never a baked flipbook; an `Animator`/`SpriteRenderer` frame
  animation on a UI `Image` → `<Flipbook>` with the clip; `AnimationState`
  calls from the view's script (`SetAnimation`, `AddAnimation`, `timeScale`, `Skin`) → props driven by the model.
