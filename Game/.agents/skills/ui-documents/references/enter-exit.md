# Keyed Enter and Exit, staggers and the tap lock

A pose plays every layer from one look to the design together. A **track** gives one layer its own keys,
length (`transition=`) and `delay=` (ms) inside the view's Enter or Exit: overshoots, a drop with a bounce, a
squash and stretch, children popping in one after another. `at=` is a share of the track (0–1); an Enter ends
on the design and an Exit starts on it, so leave those keys out. Each step between keys eases by the track's
transition, or by the key's `ease=` (`linear`, `easeIn`, `easeOut`, `easeInOut`, `smooth`: `smooth` turns
gently at each key, like Unity's auto tangents, and fits overshoot curves). A layer's pose becomes its
track's first key; a layer has one or the other.

A key may also set **`sizeX` / `sizeY`**: the layer's drawn size as a share of its laid-out size (0–4, 1 is
the design), about its centre, with no re-layout. It is Unity's `SetSizeWithCurrentAnchors`, not a scale:
a sliced background redraws at the new size with its borders intact, `clip=yes` clips to the resized box,
anchored children ride its edges at their own size (at a percentage size they resize with it), and flowed
children keep their size and follow the layer's `justify` / `align` (the default, start, rides the top edge,
`end` the bottom one, `center` stays put), so content is revealed, not squashed. `clipContent=yes` clips inside `pad`, which keeps its size. Port a Unity frame that animates its rect
height with `sizeY`, and one that animates its scale with `scaleY`. Taps land on the drawn box.

```sh
# Unity's popup frame: unrolls with two overshoots over 0.5 s, fades in over the first half,
# its button pops in after 150 ms, and taps wait 0.25 s.
gameengine ui doc track no-lives nl_frame --pose enter "transition=linear 500" at=0 sizeY=0 opacity=0 ease=smooth
gameengine ui doc track no-lives nl_frame --pose enter at=0.5 sizeY=1.05 opacity=1 ease=smooth
gameengine ui doc track no-lives nl_frame --pose enter at=0.7 sizeY=0.975 ease=smooth
gameengine ui doc track no-lives nl_frame --pose enter at=0.85 sizeY=1.0125 ease=smooth
gameengine ui doc track no-lives nl_ok --pose enter "transition=back 300" delay=150 at=0 scale=0
gameengine ui doc settings no-lives lockInput=250            # yes: the whole Enter; no: none
# It closes in 0.25 s: a bulge, then a collapse as it fades.
gameengine ui doc track no-lives nl_frame --pose exit "transition=linear 250" at=0.136 sizeY=1.186 ease=easeIn
gameengine ui doc track no-lives nl_frame --pose exit at=1 sizeY=0 opacity=0
gameengine ui doc track no-lives nl_frame --pose enter at=0.7 --remove   # one key; without at=, the whole track
gameengine ui doc track no-lives nl_frame --pose enter --keys '[{"at":0,"set":{"scaleY":0}},{"at":0.5,"set":{"scaleY":1.05}}]'
```

- Unity's frame mask (a RectMask2D with fixed insets, content riding its bottom edge): `clip=yes` on the frame
  would clip a header sticking out above it too, so mask a flowed layer around the content instead, as tall
  as the frame: move the frame's vertical `pad` onto it, give it `clipContent=yes`, `justify=end` and the
  frame's `sizeY` keys, and set the frame to `justify=center` so the layer stays centred in it. Keep that
  layer's height from its content: at `h=100%` it would follow the frame and its own keys resize it twice.
- A key that sets only `sizeY` sets `sizeX` back to 1 (as `scaleY` alone does `scaleX`); key both when the
  two axes move at different times.
- Port a Unity clip key by key: a curve's normalised time is `at=`, the clip's length the track's `transition`.
  Keys of different lengths on one layer (alpha over 0.25 s in a 0.5 s clip) go in one track, at their times.
- `lockInput` holds every tap off while the view enters: its buttons do nothing and nothing under it gets the
  tap. Exit always ignores taps. Popping a screen plays its Enter back with the stagger mirrored.
- See it with `gameengine view render doc:<name> --times 0,0.1,0.25,0.5` and `--phase exit`.
