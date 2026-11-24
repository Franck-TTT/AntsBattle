# Cameras between UI views and inside one view

## A camera between UI views (the Unity way)

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

## A camera between two elements of one view (world slots)

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
