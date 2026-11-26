/**
 * Chromatic aberration on the screen edges only, shaped like a vignette: no split inside `inner`,
 * full split from `outer` on (0 is the centre, 1 a corner). Red is pushed outwards and blue inwards
 * along the line from the centre. Runs over the UI (stage `overlay`).
 */
import { clamp, length, material, max, postColor, postSize, postTexel, screenUV, smoothstep, uniform, vec2, vec3 } from '@gameengine/materials';

export default material('ChromaticEdges', {
  domain: 'post',
  stage: 'overlay',
  params: {
    strength: uniform.f32(6, { doc: 'Red/blue split at full effect, in pixels at 1080p', min: 0, max: 32 }),
    inner: uniform.f32(0.55, { doc: 'Where the split starts (0 centre, 1 corner)', min: 0, max: 1 }),
    outer: uniform.f32(1, { doc: 'Where the split is full (0 centre, 1 corner)', min: 0, max: 1.5 }),
  },
  post: ({ strength, inner, outer }) => {
    const uv = screenUV();
    const aspect = postSize().x.div(postSize().y);
    const p = uv.sub(0.5).mul(vec2(aspect, 1));
    const d = length(p);
    const mask = clamp(smoothstep(inner, outer, d.div(length(vec2(aspect.mul(0.5), 0.5)))), 0, 1);
    // Unit direction away from the centre in square pixels, then back to UV units.
    const dir = p.div(max(d, 0.0001));
    const px = postSize().y.div(1080);
    const off = dir.mul(strength.mul(px).mul(mask)).mul(postTexel());

    const r = postColor(uv.add(off)).x;
    const g = postColor(uv).y;
    const b = postColor(uv.sub(off)).z;
    return vec3(r, g, b);
  },
});
