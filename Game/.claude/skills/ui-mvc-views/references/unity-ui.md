# Unity ports: layout groups, 9-slice and the Image mapping

## Layout

Layout is flexbox and grid (Taffy); Unity's layout groups map onto them:

| Unity | Here |
|---|---|
| HorizontalLayoutGroup / VerticalLayoutGroup | `<Row>` / `<Column>` (`flex-direction`), `gap` for spacing, `padding` |
| Child Force Expand (each child centred in an equal share) | children `flex: 1 1 0`, content centred with `justify-content: center` / `align-items: center` inside each child |
| Child Alignment | `justify-content` (main axis) and `align-items` (cross axis) on the container |
| LayoutElement preferred / flexible width | `flex-basis` = preferred, `flex-grow` / `flex-shrink` = flexible, `min-width` = min |
| GridLayoutGroup (cell size, spacing, constraint count) | `display: grid; grid-template-columns: repeat(<count>, <cell>px); gap: <spacing>px` |
| ContentSizeFitter | the default: a box without a size fits its content |

## 9-slice

Sprites (`<Sprite>`/`<Image>`, or `background-image` on any element) draw stretched, 9-sliced,
filled, tiled or mirrored. **Border values are source texels** (the PNG as the artist made it,
before gmeta `max_size`), never screen px.

- **Order.** Put borders on the texture once, in its `.gmeta`, and use `auto` everywhere:
  `[settings] border = { top = 12, right = 18, bottom = 8, left = 6 }` → `<Sprite src="ui/frame" slice="auto" />` or
  `background-slice: auto;`. Inline: the prop takes **named sides** `slice={{ top: 12, right: 18, bottom: 8, left: 6 }}`
  or one number; CSS takes **`top right bottom left`** like `margin` (`background-slice: 12 18 8 6`). Arrays are refused
  (Unity's `spriteBorder` is x=left, y=bottom, z=right, w=top: never copy the four numbers in that order).
- **Body and content padding live there too.** `body = { bottom = 16 }` is the box inside the texture: the art outside
  it (a button's hard shadow) draws past the element without growing its layout or hit area. `content = { top = 48,
  right = 104, bottom = 56, left = 104 }` (inside the body) is the padding of every element showing the texture on the
  sides it does not pad itself. Both apply where the texture draws 9-sliced (`slice="auto"` with a border), never to an
  image leaf (`<Sprite src>` alone is measured as its whole texture). A declared `background-outset` or `padding-*`
  wins. Set them once and drop the per-view paddings that repeated them.
- **Keep it round.** Borders wider than the box on an axis shrink in proportion (Unity's GetAdjustedBorders), which
  squashes round corners and caps. So:
  - `sliceScale` keeps each border at most half of the box's smaller side (top + bottom ≤ height, left + right ≤
    width): caps that draw 120 px tall at `sliceScale` 1 need 0.5 or less on a 60 px-high button.
  - A capsule (pill button, counter, bar) slices on its long axis only, with full-height caps: border left and right
    of half the texture's height, top and bottom 0, and a `sliceScale` that makes the caps exactly the box's height.
  - Labels centre on the texture's `.gmeta` `content` box (it pads every element showing the texture, a `<Sprite
    slice="auto">` with children included), never on hand-tuned margins or offsets per view.
  - A progress fill grows instead of being clipped (`reveal: horizontal` with `background-fill-keep: caps`, or
    `keepCaps` in a document), on its sliced art or on a `border-radius` colour box, so it keeps its round end at every amount.
- **Check it.** `gameengine view render <View>` prints `warning: … leave no stretchable middle …` when left+right
  (or top+bottom) cover the whole image while the element is stretched on that axis: the signature of swapped borders.
  It (and `gameengine ui layout`, and `gameengine view lint` over every view on the slim and wide device) also warns
  about caps squashed by a small box (with the `sliceScale` that keeps them round), round art stretched without a
  border or with caps at another scale than the box (`stretched art`, `stretched caps`), a Fill that cuts a round end
  square (`cut caps`, `square fill`), a child out of its parent,
  in-flow siblings drawn over each other, text larger than its box, a label off its face's content box, and
  text or an icon touching the edge of the face it sits on. Fix what it names; mark a badge or ribbon placed
  over an edge on purpose with `overlap: attach` (`attach` in a document), and a face meant to touch its
  content with `edge-margin: 0` (`edgeMargin` in a document). `gameengine check --strict` fails on them.

| Unity (Image / Canvas) | Game Engine |
|---|---|
| Sprite Editor border (L, B, R, T) | gmeta `border = { left, bottom, right, top }` + `slice="auto"` |
| Image Type Sliced | `slice="auto"` / `background-slice: auto` |
| Android nine-patch padding and optical bounds | gmeta `content = { … }` and `body = { … }` |
| Pixels Per Unit Multiplier `m` (sprite PPU `p`, canvas ref PPU 100) | `sliceScale = 100 / p / m` (`background-slice-scale`) |
| Borders wider than the rect (GetAdjustedBorders) | same: both shrink in proportion |
| Fill Center off | `fillCenter={false}` / `fill-center: false` |
| Image Type Tiled | `tile` / `background-repeat: repeat` (a sliced image keeps its corners and repeats its edges and centre; without borders the whole image repeats; `fit` is ignored) |
| Image Type Filled, Horizontal/Vertical/Radial360, origin, clockwise, fillAmount | `fill={{ method: 'radial360', origin: 'top', amount, clockwise }}` / `background-fill: radial top 75%` (no 9-slice while filled; Radial90/180 unsupported) |
| negative `localScale.x` on an Image | `flip="x"` / `background-flip: x` (or `transform: scale(-1, 1)`, same pixels, also flips children) |
| a half-frame plus its mirrored copy | one element: `mirror="x"` / `background-mirror: x` with the half art |
| RectMask2D / Mask on a scroll list | `overflow: hidden` (a screen-aligned scissor; clicks outside are ignored); `RectMask2D.softness` (x, y) is `clip-softness: <x>px <y>px`. A `Mask` on an Image (sprite-shaped, `showMaskGraphic` off) is `mask-image: url("<image>")` on the same-sized element: it and its children draw through the image's alpha; a *Sliced* mask image adds `mask-slice: auto` (its `.gmeta` borders keep their size). In a UI document it is the `mask` field |
| ScrollRect (drag, inertia, wheel, elasticity, snapping) | `<ScrollView>` (`horizontal` for a horizontal one), `overscroll: bounce`, `scroll-snap`; no scrollbars |
| Canvas Screen Space - Camera, sortingOrder `k` | `views.push(V, m, { order: k })` / `defineView({ order: k })` (skill `camera`) |
| Canvas Screen Space - Overlay | `views.push(V, m)` (no order: over every camera) |
| CanvasScaler ScaleWithScreenSize, match 0 / 1 / 0.5 | `"ui": { "referenceResolution": [w, h], "match": "width" \| "height" \| 0.5 }` (default `"fit"`) |
| An aspect-adjusted CanvasScaler (match height, width below the reference aspect) | `"match": "fit"`, never `"height"` plus transforms on anchor boxes (skill `screen-fit`) |
| Image Preserve Aspect | `fit="contain"` / `object-fit: contain` (`cover` fills the box and cuts the rest) |
| a material with additive / multiply blending on an Image | `blend="additive"` / `mix-blend-mode: plus-lighter`; `multiply`, `screen` |
| TMP outline | `text-stroke: 4px #000` (up to 0.2 em; up to about 0.08 em, e.g. 4 px on 53 px text, it is one dilated copy of the glyph, as TextMeshPro's; wider ones draw as rings of copies, so keep those to short labels) |
| TMP Color Gradient (vertical, or any angle) | the web's gradient text: `background: linear-gradient(#ffe066, #ff9a00); background-clip: text;` (top to bottom by default; `to right`, `45deg`, up to 5 stops; the gradient spans the element's box, not each letter). A gradient on a box is not drawn: use an image |
| TMP underlay (offset, dilate, softness) | `text-shadow: 0 6px <blur> <spread> #000`: blur and spread top out around 1/16 em |
| TMP rich text (`<b>`, `<i>`, `<color=#hex>`, `<size=…>`) | `<Text rich>` with the same tags (`<size=1.5>` is an em multiplier, not points) |
| TMP sprite assets (`<sprite=0>`, `<sprite name="…">`) | `<img src="ui/energy">` in `<Text rich>` or a `loc:` string: as tall as the capitals, in its own colours; `size=1.2`, `y=0.1` (em, up) and `tint` (the run's colour, or `tint=#rrggbb` / `tint=false`) adjust it. `<sprite>` itself stays literal text: rewrite each to its asset's key. `gameengine validate` reports a key that names no sprite (`E_INLINE_IMAGE`) in authored text; a string built at runtime is not checked, and player-typed text must not go in a rich label |
| TMP Auto Size (min / max) | `text-fit: 24px 72px` on a sized box: the largest size that fits |
| TMP keeps trailing spaces | `white-space: pre` (no wrap) or `pre-wrap`; the default trims them as CSS does |
| TMP Character Spacing | `letter-spacing: 2px` (UI documents: `letterSpacing`) |
| TMP UPPERCASE style | `text-transform: uppercase` (documents: `upper`); a translated label upper-cases by its own language's rules |
| TMP Bold with no bold font asset | `font-weight: 700` draws synthetic bold (documents: `weight`); a rule that picks a bold face adds `font-synthesis: none` |
| A full-bleed band under the notch (a top bar's colour) inside a `safeArea` node | `safe-area: bleed` on that child: its edges at the safe rect reach the screen's, its content keeps its place (documents: `safeArea=full`) |
| A localisation table (I2 Localization, a converter's CSV turned JSON) | Translation is a package: the localization package's own skill (`localization`; skill `packages` says how to add it) says where tables go and how `t()`, `{ "loc": … }` in documents and its `Localized` component read them |

- **Draw calls.** The UI pass batches draws that do not overlap even when they alternate in tree order (buttons and
  their labels): what still costs a draw is overlapping content with different textures, text over sprites over text.
- Match the reference too: a Unity canvas of 1284×2778 matched to height is `referenceResolution: [1284, 2778], match: "height"`,
  unless its scaler switches to width on narrower screens (most mobile ports do): then it is `match: "fit"`.
- **Row gotcha.** `Row` is `align-items: center`. A child whose own children are all `position: absolute` has height 0,
  so it is centred on the row's middle and its content hangs half a row low. Give such children `align-self: stretch`
  (or a height).
