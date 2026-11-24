---
name: post-effects
version: 1.3.0
tier: optional
description: Custom full-screen effects — domain 'post' materials, postColor/postBlur/postDepth, a post profile's effects (*.post.json), stages scene/display/overlay, per-device overrides, optional effects, post.set/post.clear. Use for a blur, hit flash, colour wash, frosted pause screen, fog or any look the fixed post stack lacks.
---

# Post effects

A post effect is a `*.material.ts` with `domain: 'post'` (`@gameengine/materials`), listed in a
post profile's `effects` (`*.post.json`) and driven at run time with `post` from
`@gameengine/runtime`. Bloom, tonemapping, grading, vignette, SSAO, depth of field and
anti-aliasing stay the profile's fixed fields (skill `device-tiers`). Surface materials are skill
`vfx-materials`.

## The rule: presentation only

Effects change pixels, never the game. Nothing about them is hashed, saved or replayed:
`post.set` and `post.clear` throw inside fixed-step systems, so call them from UI code or a
`LateUpdate` system (skill `sim-boundaries`). A hit flash reads the sim's event in `LateUpdate`;
the sim never asks whether an effect is showing.

## Ready-made effects

`@gameengine/materials/post` has six effects, each a one-line effect file. Start from one before
writing your own; each is short enough to copy and change.

```ts
// assets/post/pause_blur.material.ts
import { blur } from '@gameengine/materials/post';
export default blur({ radius: 16 });
```

| Effect | For | Parameters (`values` by name) | Default stage |
| --- | --- | --- | --- |
| `blur({ radius })` | pause screen, menu over the game, dream | `radius` (px at 1080p) | `display` |
| `colorFlash({ color })` | hit, pickup, camera flash: fade it with the weight | `color` | `overlay` |
| `vignettePulse({ color, strength, inner, outer, pulse })` | low health, danger; `pulse` beats a second (fixed at compile; redraws every frame while it runs) | `color`, `strength`, `inner`, `outer` | `display` |
| `desaturate({ amount, tint })` | flashback, frozen moment, game over | `amount`, `tint` | `display` |
| `wipe({ color, softness, from })` | scene transition: tween `progress` 0 to 1; `from` is `left`, `right`, `up`, `down` or `circle` | `progress`, `color`, `softness` | `overlay` |
| `wobble({ amplitude, frequency, speed })` | underwater, dizzy, heat (redraws every frame) | `amplitude`, `frequency`, `speed` | `display` |

Every one takes `stage` to move it. A wipe from game code: `post.set('wipe', { enabled: true, values: { progress } })`.

**Blur behind a popup is not a post effect:** set `ui.scrim.blur` (skill `ui-mvc-views`) or the
UI style `backdrop-blur`. That blurs only what is under the popup, inside its box, and the popup
itself stays sharp.

## Write an effect

```ts
// assets/post/frosted.material.ts
import { material, mix, postBlur, postColor, uniform } from '@gameengine/materials';

export default material('Frosted', {
  domain: 'post',
  stage: 'display', // default; 'scene' or 'overlay'
  params: {
    amount: uniform.f32(1, { min: 0, max: 1 }),
    tint: uniform.color('#dde8ff'),
  },
  post: ({ amount, tint }) => mix(postColor(), postBlur(undefined, amount.mul(24)).mul(tint.rgb), amount),
});
```

`gameengine material compile` writes the `*.material.gen.json` beside it (the editor and
`gameengine run` do it on save). The `post` function returns the pixel's new colour; the engine
mixes it over the old one by the effect's weight, so weight 0 is the frame unchanged.

| Node | Gives |
| --- | --- |
| `postColor(at?)` | The frame so far at `at` (default this pixel, `screenUV()`): the previous effect's output |
| `postBlur(at, radius)` | The frame blurred by `radius` pixels at 1080p (two taps at any radius, from a blur pyramid built only when an effect reads it) |
| `postDepth(at?)` | Linear distance from the camera in world units; very large where nothing was drawn. `postDepthAvailable()` is 0 where the device has no depth (it returns its fallback) |
| `postTexel()`, `postSize()`, `postWeight()` | One pixel in UV units, the target size, the effect's weight |
| `screenUV()`, `time()`, `materialGlobal(i)` | As in surface materials |

Parameters are uniforms only (no textures yet). Surface nodes (`worldPosition`, `sceneColor`…)
are refused in a post material, and post nodes in a surface one.

## Stages

| Stage | Runs | Reads |
| --- | --- | --- |
| `scene` | On the HDR scene, after depth of field, before bloom and tonemapping | colour, blur, depth |
| `display` | On the finished frame, after tonemapping, grading and anti-aliasing, before UI | colour, blur, depth |
| `overlay` | Over everything, UI included (only when the camera draws to the screen, and not with `render.uiBlend: "gamma"`) | colour, blur (no depth) |

Use `scene` for anything that should bloom and be tonemapped (heat haze, fog), `display` for
looks on the final image (frosted pause, tilt-shift, colour wash), `overlay` for flashes and
fades that must cover the UI.

## List it in a profile

```json
{
  "tonemap": "agx",
  "effects": {
    "frosted": { "material": { "guid": "…" }, "weight": 0, "values": "amount=0.6; tint=#dde8ff" },
    "edgeBlur": { "material": { "guid": "…" }, "order": -1, "optional": true }
  },
  "overrides": { "phone-low": { "effects": { "edgeBlur": null } } }
}
```

- The key is the effect's id (a letter, then letters, digits, `_` or `-`; at most 32); game code uses it.
- `order` (default 0) sorts effects within a stage, then the id. `enabled` (default true),
  `weight` (0 to 1, default 1), `values` (`name=value; …`, as `MaterialOverrides`).
- `optional: true`: the quality governor drops it first on a hot or slow device (`post: reduced`).
- `overrides` work as everywhere (skill `device-tiers`): `null` removes an effect on that device,
  or set a cheaper `values`. A profile with only `effects` adds no tonemapping or bloom.
- Limits: 16 effects in a profile, 8 running in one stage, `blurLevels` (0–6) caps the pyramid.

## Drive it from game code

```ts
import { defineSystem, post } from '@gameengine/runtime';
import { FlashFade, PlayerHit } from './schema.gen.ts'; // FlashFade: a sim: false resource { weight: f32 }

// "flash": an overlay effect the profile lists with "weight": 0.
export const HitFlash = defineSystem({
  name: 'HitFlash',
  stage: 'LateUpdate',
  events: [PlayerHit],
  resources: [FlashFade],
  run(ctx) {
    const last = ctx.resource(FlashFade).weight[0]!;
    const weight = ctx.events.count(PlayerHit) > 0 ? 1 : Math.max(0, last - ctx.dt * 4);
    if (weight === last) return;
    ctx.setField(FlashFade, 'weight', weight);
    post.set('flash', { weight, values: { tint: '#ff4040' } });
  },
});
```

Keep the fading weight in a `sim: false` resource or component, never module state. Calls:

- `post.set(id, { weight?, enabled?, values? })` merges over the profile; all or nothing (a bad
  value throws `E_ARG`). Values: a number, 2–4 numbers or `#rrggbb[aa]`.
- `post.clear(id?)` forgets what game code set (one effect or all): the profile rules again.
- Settings are kept by id until cleared or the world is rebuilt, whichever profile the camera uses.
- At most 16 ids and 16 values per effect (`E_LIMIT`).

## Cost and devices

A project without effects pays nothing. Each running effect is one full-screen pass at the
stage's size; the blur pyramid is built once per stage that reads it (a chain of quarter-size
passes, 2 levels on compat, 4 on mobile, 6 on desktop); depth is read only where an effect asks.
On phone-low budget about one display effect: mark extras `optional` or remove them in
`overrides`. The `postEffects` quality feature (on by default) switches every effect off for a
level; `quality show` lists it. A game with post that ships on Android turns `render.android.drawIntoWindow` on (skill `device-tiers`).

## Check it

- `gameengine screenshot` of the game, per tier (`--gpu-tier compat|mobile|desktop`) and with
  `--memory-class phone-low`, to see the effect and its device overrides.
- A `renderTest`: `render.stats().passes` names each running effect `post.effect:<id>` and the
  pyramid `post.blur.<stage><n>`; `render.probe` reads pixels; `assets.setDeviceClass('phone-low')`
  shows the override.
- `gameengine material validate` compiles every post material on every tier.
- A UI backdrop shows as `ui.backdrop` in `render.stats().passes`, the UI after it as `2d.ui.over`.
