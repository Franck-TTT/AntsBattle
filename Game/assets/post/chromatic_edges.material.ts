/**
 * Chromatic aberration on the screen edges only, shaped like a vignette: no split inside `inner`,
 * full split from `outer` on (0 is the centre, 1 a corner). Red is pushed outwards and blue inwards
 * along the line from the centre. Runs over the UI (stage `overlay`).
 *
 * The values come from the balancing sheet's General parameters (Post effects): sheet-sync and the
 * editor's General Params widget write them into neon.post.json (src/post-profile.ts).
 */
import { clamp, length, material, max, postColor, postSize, postTexel, screenUV, smoothstep, uniform, vec2, vec3 } from '@gameengine/materials';

export default material('ChromaticEdges', {
  domain: 'post',
  stage: 'overlay',
  params: {
    strength: uniform.f32(6, { doc: 'Red/blue split at full effect, in pixels at 1080p', min: 0, max: 32 }),
    inner: uniform.f32(0.55, { doc: 'Where the split starts (0 centre, 1 corner)', min: 0, max: 1 }),
    outer: uniform.f32(1, { doc: 'Where the split is full (0 centre, 1 corner)', min: 0, max: 1.5 }),
    insetTop: uniform.f32(0, { doc: 'Reference box: margin from the top edge, in screen heights', min: 0, max: 0.9 }),
    insetBottom: uniform.f32(0, { doc: 'Reference box: margin from the bottom edge, in screen heights', min: 0, max: 0.9 }),
    insetLeft: uniform.f32(0, { doc: 'Reference box: margin from the left edge, in screen widths', min: 0, max: 0.9 }),
    insetRight: uniform.f32(0, { doc: 'Reference box: margin from the right edge, in screen widths', min: 0, max: 0.9 }),
  },
  // Distances are measured in the reference box (the screen minus the insets): 0 its centre, 1 its
  // corners. The effect is not clipped to the box: past its edges the split keeps growing to full.
  post: ({ strength, inner, outer, insetTop, insetBottom, insetLeft, insetRight }) => {
    const uv = screenUV(); // y-down: 0 is the top edge
    const centre = vec2(insetLeft.sub(insetRight).add(1).mul(0.5), insetTop.sub(insetBottom).add(1).mul(0.5));
    const half = vec2(insetLeft.add(insetRight).mul(-1).add(1), insetTop.add(insetBottom).mul(-1).add(1)).mul(0.5).mul(postSize());
    // From the box centre in pixels, so the direction is round on any screen shape.
    const p = uv.sub(centre).mul(postSize());
    const d = length(p);
    const mask = clamp(smoothstep(inner, outer, d.div(max(length(half), 1))), 0, 1);
    // Unit direction away from the centre, then back to UV units.
    const dir = p.div(max(d, 0.0001));
    const px = postSize().y.div(1080);
    const off = dir.mul(strength.mul(px).mul(mask)).mul(postTexel());

    const r = postColor(uv.add(off)).x;
    const g = postColor(uv).y;
    const b = postColor(uv.sub(off)).z;
    return vec3(r, g, b);
  },
});
