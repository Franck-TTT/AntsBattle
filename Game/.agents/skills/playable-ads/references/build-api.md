# Build API: answers to read before writing an ad's systems and `web/mirror.ts`

Look here before grepping engine source or parsing `engine.schema.json`. Engine types, resources
and events come from `@gameengine/runtime`; types you declare come from the project's generated
`src/schema.gen.ts` (`gameengine gen`).

## What fields does an engine component have (`Sprite`, `LocalTransform`, `Parent`, `Drag`, `Tap`, `PointerState`, `WorldView`)?

`.gameengine/engine/docs/generated/schema.md` lists every engine component, resource, tag, event
and enum with field, type, default and meaning. `gameengine skills update` (the session start
hook runs it) links `.gameengine/engine` in the project. Read one type, not the file. The `.`
around the name stands for its backticks, because a command that contains a backtick waits for
the user's permission in an agent's shell:

```sh
sed -n '/^### .Sprite.$/,/^### /p' .gameengine/engine/docs/generated/schema.md
```

There is no `SortingLayer` type: `Sprite.sortingLayer` is a name from `render.sortingLayers` in
`project.gameengine.json`; list order is draw order (skill `atlasing`).

## How do I declare components, resources and events (`schema/*.schema.ts`)?

```ts
import { asset, component, enumOf, event, f32, resource, tag, u32, vec2 } from '@gameengine/schema';
export const Piece = component('Piece', { kind: enumOf('Kind', ['Red', 'Blue'], { default: 'Red' }), home: vec2(), speed: f32({ default: 2 }) }, { sim: true });
export const Score = resource('Score', { points: u32() }, { sim: true });
export const Hit = event('Hit', { power: f32() }, { sim: true });
export const Held = tag('Held', { sim: true });
export const Art = component('Art', { image: asset('texture') }, { sim: false });
```

- The third argument `{ sim }` is required: `true` is hashed and readable by sim systems; `false` is
  presentation only (skill `sim-boundaries`).
- Names are PascalCase, fields camelCase. Field kinds: `f32 f64 i32 u32 i16 u16 i8 u8 bool vec2 vec3
  vec4 quat color mat4 entity string guid`, `asset(type)`, `enumOf(name, values)`, `array(f32(), n)` (a field, not a kind name).
  Options: `{ default, min, max, doc }`. `vec2({ int: true })` is an integer vector.
- Run `gameengine gen` after every edit.

## How does a scene file write entities, components, parents, resources?

```json
{ "$schemaVersion": 2, "guid": "<uuid>", "id": "main",
  "resources": { "Score": { "points": 0 }, "WorldView": { "orthoSize": 8, "designAspect": 0.5625 } },
  "entities": [
    { "name": "Camera", "id": "camera", "Camera": {}, "LocalTransform": { "position": [0, 0, 10] } },
    { "name": "Card", "id": "card", "LocalTransform": { "position": [1, 2, 0] },
      "Sprite": { "image": { "guid": "<guid from assets/art/card.png.gmeta>" }, "size": [2, 3], "sortingLayer": "Board" } },
    { "name": "Badge", "id": "badge", "LocalTransform": {}, "Parent": { "entity": "@card" } } ] }
```

- A component's name is its key, and only its fields that differ from the default are written;
  resource values stay as written. Colors are `"#rrggbb"` or `"#rrggbbaa"`, vectors arrays, enums names.
- Entity references are `"@id"`; asset references are `{ "guid": "…" }`, the GUID in `<file>.gmeta`.
  A `"children": [ … ]` array nests entities and is the same as `Parent`.
- Set a resource without editing JSON: `gameengine cmd scene.setResource --scene <file>
  --resource Score --value '{"points":3}'`. After hand edits run `gameengine fmt` (it rewrites every
  scene and prefab in the project; it takes no file).

## How does a system emit, read and count events?

`ctx.events.emit(Hit, { power: 2 })`, `ctx.events.count(Hit)`, `ctx.events.forEach(Tap, (e) => use(e.world))`,
`ctx.events.read(Hit)`. There is no `ctx.emit`. Declaring and ordering: skill `ecs-systems`.

## What is on `ctx`, and how do I declare several queries?

- `ctx.step`, `ctx.dt` (fixed step length, seconds), `ctx.time` (`step * dt`), `ctx.rng`,
  `ctx.commands`, `ctx.events`, `ctx.input`.
- Resources (declare `read(T)` / `write(T)` in `resources`): `ctx.resource(Score).points[0]` views,
  `ctx.get(Score)` decoded copy, `ctx.set(Score, { points: 3 })`, `ctx.setField(Score, 'points', 3)`.
- `ctx.local(() => ({ t: 0 }))`: state between frames, **LateUpdate systems only**; it throws in sim.
- Several queries: `queries: { cards: query(read(Piece), write(LocalTransform)), slots: query(read(Slot)) }`,
  then `run(ctx, q) { for (const c of q.cards.chunks()) … }`. One query: `query:` and `run(ctx, q)`.
  Filters: `withTag(T)`, `without(T)`, `changed(T)`, `added(T)`; `q.count` counts without views.
- A chunk `c`: `c.length`, `c.col(T).field[i]` (vectors: lanes per row, `position[i * 3 + 1]`),
  `c.get(T, i)`, `c.set(T, i, { … })`, `c.setField(T, i, 'f', v)`, `c.entity(i)`.
- Commands: `ctx.commands.spawn({ LocalTransform: { position: [x, y, 0] }, Sprite: { image: 'art/card.png' } })`
  (components keyed by name; an asset field takes a GUID or a project path under `assets/`),
  `.despawn(e)`, `.insert(e, T, {…})`, `.remove(e, T)`, `.set(e, T, {…})`, `.setField(e, T, 'f', v)`.

## Which math and random do sim systems use?

`import { math } from '@gameengine/runtime'`: `math.sin cos tan atan atan2 asin acos exp log pow sqrt
abs floor ceil trunc min max clamp(x, lo, hi) lerp(a, b, t) round PI`. `round` rounds half up. There
is no `hypot`: use `math.sqrt(x * x + y * y)`. Never `Math.sin/cos/pow/random` on sim values.
`ctx.rng`: `float()` in [0, 1), `range(lo, hi)` integer in [lo, hi), `between(lo, hi)` float,
`chance(p)`, `pick(items)`, `shuffle(items)` in place (skill `determinism`).

## How do `playable.json` `assets` keys map to what systems and the mirror see?

`"assets": { "bg": "art/bg.png" }`: the **key** (`[A-Za-z0-9_-]+`) indexes `images`, `sounds`,
`videos` in `playable:manifest` for the core phase (a later phase's assets: `loader.get(<phase>)`,
skill `playable-ad-porting`); the **value**, the alias, is a file under `assets/` (the ad's before
the game's), with or without extension. `aliases` maps alias → key, exactly as written.

A sprite reaches `drawSprites` under one string, and `images` there must be keyed by it:
- named by `{ "guid" }` in a scene: the file's path under `assets/` **with** extension (`art/bg.png`);
- set by a system with a path (`image: 'art/bg.png'`): that path as written, unless the scene already holds the file by GUID (then the form above).

So write the full path with extension as the `assets` value and in code, and build
`byAlias = Object.fromEntries(Object.entries(aliases).flatMap(([alias, key]) => (img[key] ? [[alias, img[key]!]] : [])))`.
The same holds for `PlaySound.sound`: `aliases[s.sound]` gives the sound key.
Pass `refs: slice.refs` to `createPlayable`; without it asset fields stay raw GUIDs and match nothing.

## What does the web runtime give `web/mirror.ts`?

The wiring is in skill `playable-ad-porting`; these are the signatures it uses (`@gameengine/playable`).
Its sources are in `.gameengine/engine/packages/playable/src/` (`stage.ts`, `canvas.ts`); do not
search the disk for them.

- `createStage(width = 1080, height = 1920, background: string | null = '#140c2a', { maxDpr, renderScale, maxFps })`
  returns `{ canvas, ctx, width, height, toDesign(x, y), toView(x, y), loop(frame(dt)) }`. Inside
  `loop`'s callback `ctx` draws in design units; `loop` clamps `dt` to 1/20 s.
- `drawSprites(ctx, world, { width, height, images, sortingLayers, pixelsPerUnit, clips?, particles? })`
  draws every visible `Sprite` with a `WorldTransform`, an entry in `images` and a non-zero `size`:
  size 0 (the image's own size in the engine) draws nothing here, so give every sprite a `size`.
  `width`/`height` are the stage's, `images` maps the string above to an image, `sortingLayers` and
  `pixelsPerUnit` come from `playable:slice`. It fits the view from the `WorldView` resource,
  ignores rotation, and of `color` uses only the alpha.
- `resource(p.world, 'Score')` is the decoded resource or `undefined`. `stepEvents(p.world, 'Hit')`
  is this step's events, each once, as an array: read it right after each `p.step(...)`.
- Pointers: `listenPointers(stage, push, onFirstTouch?)` and `viewEvent(stage)`, both into
  `p.step([...events])`. Never write components from `web/`.
- World and screen: `const half = viewHalfExtents(fit, orthoSize, designAspect, aspect)`, with `fit`
  0 Height, 1 Width, 2 Contain, 3 Cover and `aspect = width / height`; then
  `worldToScreen([x, y], [width, height], center, half)` and `screenToWorld([px, py], [width, height], center, half)`.
  `center`, `orthoSize`, `fit` (a name), `designAspect` are the `WorldView` resource's fields.
