---
name: camera
version: 1.7.1
tier: required
description: Cameras — read before adding, moving, aiming, framing, zooming, following, shaking or switching a Camera. The three kinds (2D, tilted ortho, perspective), what WorldView drives, CameraFollow, CameraShake, VirtualCamera, WorldViewFollow, `gameengine camera list|visible|frame|shot`, W_CAMERA_* codes, cameras between UI views (order, layerMask).
---

# Cameras

**Covers:** which kind of camera you have, who drives each of its values, moving, following,
shaking and switching cameras, screen and world conversions, and proving what a camera shows.
Fitting a board to every screen shape is skill `screen-fit`.

**Start every camera task with `gameengine camera list`.** It prints each camera's kind, what
drives each value (`WorldView`, a rig, its own fields) and what it shows. Never reason about a
camera from the scene file alone.

## 1. The kind decides everything

| Kind (`camera list`) | `Camera` | Placed by | View size |
|---|---|---|---|
| `flat2d` (board, side view) | `Orthographic`, looking down -Z | `WorldView.center` | `WorldView.orthoSize`, `fit`, `designAspect` |
| `ortho3d` (isometric, top-down 3D) | `Orthographic`, tilted more than about 2.5° off -Z | `LocalTransform` | `WorldView.orthoSize`, `fit`, `designAspect` |
| `perspective` | `Perspective` | `LocalTransform` | `fovY` |

- `Camera.space` forces the kind (`Space2D`, `Space3D`); `Auto` uses the 2.5° rule. The scene view, particles, screen ops and `camera list` all use this one rule.
- **The first orthographic camera takes `orthoSize`, `fit`, `designAspect` (and in 2D its x/y) from the `WorldView` resource.** Its own fields are ignored; `validate` warns `W_CAMERA_DRIVEN` when they were edited. Change `WorldView` in a sim system instead.
- When several cameras could be the 3D one, perspective wins over tilted ortho, then the lowest `order`.
- A 2D camera looks down -Z, so a higher z is nearer. 2D draw order does not use the camera: it is sorting layer, then `order`, then y or z on `sortByY`/`sortByZ` layers (skill `atlasing`), the same under every camera. Unity's camera looks along +Z: negate z when porting Unity content onto a `sortByZ` layer.

## 2. Move it the right way

| You want | Do this | Never |
|---|---|---|
| Place or aim a camera | `LocalTransform` | `VisualOffset` to place it (`W_VISUAL_OFFSET`) |
| Move or zoom a 2D view | Write `WorldView` in a sim system (taps map through it) | Edit the camera's transform or `orthoSize` |
| Follow a target in 2D | Set the `WorldViewFollow` resource (`target`, `damping`, `deadZone`, `lookahead`, `bounded` with `boundsMin`/`boundsMax`); it runs in the sim, replays repeat it | `CameraFollow` on a flat camera (`W_CAMERA_FOLLOW_2D`) |
| Follow a target in 3D | `CameraFollow` + `VisualOffset` on the camera (`offset`, `damping`, `deadZone`, `lookahead`, `bounded`) | A sim system reading `Camera` |
| Mouse-look on desktop | `services.system.setMouseCapture({ enabled: true })` from UI code (needs the `system` plugin); then `PointerHover`/`PointerMove` positions accumulate raw motion, so turn by the difference between successive ones in a sim system. Clicks land at that virtual position. Releasing, or the window losing focus, jumps the pointer back to the real cursor in one move: cap the turn per step. In editor Play the game view locks on the next click and Escape unlocks (the game gets the Escape key). Web: the browser pointer lock, taken on the next click and again after Escape (the game gets the Escape key). Answers `captured: false` in tests and phones: keep a drag fallback | Reading the OS cursor, or assuming capture held after a focus change |
| Shake | `CameraShake` + `VisualOffset` on the camera, then `shakeCamera(camera, 0.5)` from presentation. `style`: `Noise` (default, a smooth wander) or `Jitter` (a new random jolt along the world axes every frame, the hard hit of many mobile games); `falloff`: `Squared` (default, trauma²) or `Linear` (keeps more of a small shake) | Writing shake into `LocalTransform` |
| Cut or blend between shots | Entities with `VirtualCamera` (`priority`, `blend`, `fovY`) and a `LocalTransform`; the highest priority that is not Hidden or Disabled drives the camera, which needs `VisualOffset`. The shot is where the source is *drawn*, its own `VisualOffset` included, so a first-person game turns the view from presentation state (a `LateUpdate` write to the source's `VisualOffset.rotation`) ahead of the sim; the camera itself and what is under it use their sim pose | Copying poses into the camera every frame |

- Rigs (`CameraFollow`, `CameraShake`, `VirtualCamera`) are presentation: never hashed, they hold still while the game is paused and in the editor's edit world, and they need `VisualOffset` on the camera (`W_CAMERA_RIG` when it is missing; at run time the rig does nothing).
- Sim code never reads a camera or a rig. Gameplay that depends on the view uses `WorldView`.

## 3. Several cameras

- They draw in ascending `order`; a camera on top needs `clear: false` (`W_CAMERA_ORDER`: two full-screen cameras at the same order, one hiding the other). `viewport` gives split screen or an inset.
- **`layerMask` is the culling mask:** a camera draws 3D meshes whose `MeshRenderer.layers`, and 2D items and effects whose `RenderLayers.mask`, share a bit with it (default: every layer).
- **`view: 'WorldView'`** makes a second orthographic camera show exactly what the first one shows (centre, zoom, fit, shake), so it stays aligned with the board; its `order`, `clear`, `layerMask` and `viewport` stay its own.
- An orthographic camera draws between `near` (-100) and `far` (100) along its view axis: cover a tilted scene's depth.
- Limits: only the first camera with a `postProfile` gets post; only the primary camera's `renderScale` counts. MSAA is `render.tiers.<tier>.msaa` (`Camera.msaa` was removed: `E_RETIRED_API`).
- A scene with no camera draws through an implicit flat 2D camera, so its 3D meshes do not show (`W_CAMERA_NONE`).

## 3b. A camera between UI views (the Unity way)

A view pushed with an `order` sits among the cameras, as a Unity *Screen Space - Camera* canvas with a sort
order sits among camera depths: it draws after every camera whose `order` is at most its own (ties go to the
camera) and before the rest. A view without `order` draws over every camera, as an *Overlay* canvas does.
A lifted piece goes to another layer, which a second camera ordered above the view draws:

```ts
// board camera (scene):  Camera: { order: 0, layerMask: 1 }        <- must exclude the lift layer
// lift camera:           Camera: { order: 1, layerMask: 2, clear: false, view: 'WorldView' }
views.push(Strip, model, { order: 0 });   // after the board camera, under the lift camera
views.push(TopBar, model);                // no order: over everything
world.insert(piece, RenderLayers, { mask: 2 });   // lift: from presentation; mask 1 puts it down
// the piece's badge and effect follow it: children without their own RenderLayers inherit it
```

| Unity | Here |
|---|---|
| `BoardCam` depth 0, cullingMask Board | `Camera { order: 0, layerMask: 1 }` |
| `StripCanvas` Screen Space - Camera, camera BoardCam, sortingOrder 0 | `views.push(Strip, m, { order: 0 })` (or `defineView({ order: 0 })`) |
| `LiftCam` depth 1, cullingMask Lifted, Clear Flags: Don't Clear | `Camera { order: 1, layerMask: 2, clear: false, view: 'WorldView' }` |
| `TopBar` Screen Space - Overlay | `views.push(TopBar, m)` (no order) |
| `piece.SetLayerRecursively("Lifted")` | `RenderLayers { mask: 2 }` on the piece only: children inherit it unless they set their own |

- **The piece is the same entity at the same place**, its effects keep running: never rebuild it as UI
  `<Particles>`/`<Sprite>` to change layers. A flying item heading for a HUD counter does the same and moves
  towards the counter's screen point (`uiToWorld`) in presentation; the sim never reads UI layout.
- **Taps follow what is drawn:** a press on the lifted piece over an ordered view is a world tap (`Tap`), beside
  it the view's button takes it. Particles, trails and ribbons never block. `ui.press` in a test fails on a
  button a camera draws over.
- **Clears wipe:** a camera placed above an ordered view that clears wipes that view and the cameras under it
  (`W_VIEW_ORDER`): give it `clear: false`, as Unity's Don't Clear.
- Pitfalls:
  - The board camera needs a `layerMask` without the lift layer, or it draws the lifted piece under the view too.
  - A 2D lift camera (no clear, no 3D, no `postProfile`) draws after post at native resolution, with the views
    under it: the HUD stays sharp and the lifted piece gets no bloom or grading. A camera with a `postProfile`
    draws into the scene instead, so its effects cover it and the views under it. Under a camera that clears or draws 3D a view
    draws into the scene instead (render scale, post), and so does a lift with masks or effects on a gamma-UI
    frame.
  - Splitting one HUD into an ordered and an unordered view to get part of it under the piece makes two views
    that must line up at every aspect: order only the bar the piece crosses, and check both with `ui.rect` on a slim and a wide view.
  - A `screen` document view pushed without order over an ordered screen covers it (hides it, as any screen
    hides the screens under it): make the unordered one an `overlay` view, or give it an order too.
- `render.stats()`: `uiSlices` (ordered views drawn under a camera), `cameraPasses` (1 for a 2D lift).
- **Cost:** a 2D lift camera (no clear, no 3D) draws in the board camera's pass: no extra pass (measured on a
  Mali-G52 phone: 10.0 ms against 10.4 ms without the feature). A camera with 3D between UI views takes one extra
  pass, about 11 ms with 4x MSAA on a Mali-G52: lift in 2D where you can.

## 3c. A camera between two elements of one view (world slots)

When the camera must draw between two elements of the same view, mark the place with `<WorldSlot>`: cameras with
`uiSlot` set to its `camera` draw there in the UI's paint order, after the UI before it and before the UI after it.

```tsx
// Camera: { uiSlot: 'board', layerMask: 1 | 2 }
<Screen>
  <Background />
  <WorldSlot camera="board" layers={1} />   {/* resting pieces under the HUD */}
  <Hud />
  <WorldSlot camera="board" layers={2} />   {/* lifted or flying pieces over the HUD */}
  <PauseButton />
</Screen>
```

- A slot draws its camera's items whose `RenderLayers.mask` shares a bit with both `layers` (default: every layer)
  and the camera's `layerMask`. Use the slot when view order cannot express it; otherwise prefer `order` above.
- The slot's box does not crop: the camera draws its whole view. A slot passes presses through to the UI under it
  unless it claims them (`pointer-events: auto`): unlike ordered views, it does not route taps by what is drawn.
- A camera with `uiSlot` draws only at its slots: with no slot shown it draws nothing (`validate`: `W_CAMERA_SLOT`
  when no view has the slot). A slotted camera never clears and is never placed by view order.
- A 2D camera at a slot draws after post at native resolution with the UI under it, as a lift does; a 3D one
  draws the UI under its slot into the scene (post and render scale apply). `backdrop-blur` works only over
  every slot. 3D in a slotted camera draws at its first slot only. `render.stats().worldSlots` counts slots.
- Cost: as a 2D lift camera, no extra pass; the second slot draws only the items on its layers.

## 4. Screen and world (presentation only; they throw in sim)

- 3D: `worldToScreen(p, w, h)` and `screenToWorld(x, y, w, h, { planeY })` go through the primary 3D camera, rigs included.
  A HUD that anchors many labels each frame projects them all with one `worldToScreenMany(points, out, w, h)`
  (`Float32Array`s of `[x, y, z]` in, `[x, y, depth]` out, NaN when unseen): one host call, no allocation per label.
- 2D: `worldToUi(x, y)` / `uiToWorld(x, y)` go through `WorldView`. Taps already reach the sim in world units (`PointerState`, `Tap`); do not convert them again.
- 3D taps: a controller turns the tap into a ground point with `screenToWorld` and sends it to the sim as an input event.

## 5. Prove it before handing back

1. `gameengine camera list` — the kinds and drivers are what you meant.
2. `gameengine camera visible <entity…>` — the key objects are on screen; `camera frame <entity…> [--write]` computes a framing that fits them on the slim and wide device.
3. `gameengine camera shot [--camera <c>]` (or `gameengine screenshot --camera <c>`) — look at the slim and the wide shot. `--no-ui` on either draws the world alone, without the game UI and overlays (framing a shot under a full-screen HUD).
4. A game test: `drawnTransform(camera)` for rigs, a `worldToScreen` → `screenToWorld` round trip for conversions (see `samples/orbit-garden/tests/camera-rigs.test.ts`).
5. `gameengine check`: no `W_CAMERA_*` or `W_VISUAL_OFFSET` left that you did not mean.

In a game test, judge what the player sees, not how it is built: `worldToUi(0, 0)` moves while a 2D view
shakes or follows, whichever rig does it, and is back at rest after; for framing, project the play area's
corners with `worldToScreen` under several `input.view(w, h, scale)` sizes (a 22:9 phone, a 4:3 tablet) and
check every corner is on screen. Test taps (`tap`, `input.worldToScreen`) follow the camera's `VisualOffset`
as a player's tap does, so a tap during a shake lands off by the shake.

In the editor: select a camera to see its frustum and a preview of what it shows; **Align with
view** (Ctrl/⌘+Shift+F) moves it to the scene view (not a flat 2D camera: set `WorldView`),
**Align view to selected** (Alt+Shift+F) looks through it, **F** frames the selection. The
Inspector greys out the fields `WorldView` or a rig drives.
