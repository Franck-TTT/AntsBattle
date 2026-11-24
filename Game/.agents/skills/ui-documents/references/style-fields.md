# Style fields: the full list

Every field `gameengine ui doc add … --set` and `ui doc set` take.

**Layout** (UI Toolkit's flex model, reference px): `dir` (`column`/`row`), `align`, `justify`, `w`/`h` (`auto`,
a number, `50%`, or `clamp(min, preferred, max)` of those), `minW`/`maxW`/`minH`/`maxH`, `grow` (`w=0 grow=1` for
equal shares), `shrink`, `gap`, `pad` / `margin` (`"t r b l"` or one number),
`hide`, `clip=true` (clips children), `mask=ui/portrait_mask` (the layer and its children draw only where that
texture is opaque, 9-sliced by its `.gmeta` borders: Unity's `Mask`; code areas take it too). **Anchored** (taken out of the flow, placed on the parent):
`position=anchored anchor="1 0" offset="-8 8"` (anchor 0–1 of the parent; `pivot` follows the anchor unless set,
`centre` or `"x y"`). Use anchors for overlaps (a badge on a corner, a ribbon): a negative `margin` does not lay out as in CSS.
`offset` on a layer in the flow nudges it from where the layout puts it, without moving its siblings (a label
centred by eye on its pill: Unity's anchored position in a layout group); a pose's `offset` slides it there. Set `attach=true` on an element placed over or past its parent on purpose (a badge, a ribbon): layout
warnings then leave it out of the escape and overlap checks.

**Paint:** `bg` (`#rrggbbaa`), `radius`, `opacity`, `tx`/`ty`/`scale`/`scaleX`/`scaleY`/`rotate` (the cheap fields to
animate in poses). A state or pose eases a px-to-px `w`/`h` change (a resize, costing a layout per frame while it
plays); any other size change jumps and is warned about. **Images:** `image=ui/panel` on any element, 9-sliced by the texture's own `.gmeta`
borders (fix a border there, not per element; `sliceScale` scales it), its `.gmeta` body drawn past the box (a
hard shadow; on an unsliced, stretched image the body fills the box and the transparent margin or shadow around it
reaches past in proportion, so a sprite with padding sizes by its opaque area) and its content padding used while
the element sets none (a sized, sliced image with no children overhangs its box by its border, like the
source); `fit`, `flip`, `tile` (repeats the texels at `sliceScale` instead of stretching, Unity's Tiled: a sliced image keeps
its corners and repeats its edges and centre; `fit` is ignored), `fillCenter=false` (a frame without its centre),
`mirror=x|y|both` (half-art frames), `blend=additive|multiply|screen` (glows), `keepCaps` (a Fill that grows
the 9-slice, or a `bg` box with `radius`, instead of clipping it: a clipped pill loses its round end, so turn it on for every filling button,
counter or bar; add `squeezeCaps` for a bar whose short fills squeeze their round ends instead of starting as a
whole pill, as Unity's sliced Image does), `imageSwap=cut|fade` for images swapped by poses; colour in order `tint` (+ `tintMode`
colorize | multiply, `tintAmount`), `saturation`, `brightness`, `imageAlpha` (Grey out: `saturation=0` on the same
texture). **Fill:** `fill=horizontal|vertical|radial`, `fillAmount` 0–1, `fillOrigin` (`start`, `end` or `center`): a clip reveal
for bars and rings. **Text:** `font` (a font asset key, e.g. `fonts/Digits`, for a label that is not in the project's
default face; one per label, never changed by a state), `fontSize` (max) with `fitMin` (shrinks to fit), `weight`
(600 and up draws synthetic bold and adds the class `.ud-bold`; a project whose face is already bold sets
`font-synthesis: none` on it), `letterSpacing` (px after each letter), `upper` (upper-cased after `loc:` keys
resolve), `color`, `textAlign` (may change in a state), `outline` +
`outlineColor` (outside the letters, at most 0.2 em), `shadowX/Y` + `shadowColor` + `shadowSoft`, `gradient` (a CSS
`linear-gradient(#ffe066, #ff9a00)` filling the letters in place of `color`: top to bottom, any angle, up to 5 stops). Sizes
may be fractional (`fontSize=27.5`); a face that draws larger than the original game's at the same size takes a
project-wide multiplier in `project.gameengine.json` `ui.fontScale` (`[{ "font": { "guid": "…" }, "scale": 0.82 },
{ "font": "*", "scale": 1 }]`: the font by reference, its GUID from its `.gmeta`; `"*"` for every other font)
instead of every label's size being lowered by hand.
