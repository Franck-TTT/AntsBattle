/**
 * Exaggerated CRT look while the run is paused (settings or weapon info popup): every line
 * jitters, a few lines tear sideways, red and blue split apart, scanlines darken and a bright band
 * keeps rolling down. Stage `display`: it covers the world and the views ordered under the post
 * camera (HUD, level menu), never the popups drawn after it. Switched on and off by
 * src/present/pause-fx.ts (neon_pause.post.json).
 */
import { abs, clamp, fract, material, postColor, postSize, postTexel, screenUV, sin, smoothstep, step, time, uniform, vec2, vec3 } from '@gameengine/materials';

export default material('CrtPause', {
  domain: 'post',
  stage: 'display',
  params: {
    shift: uniform.f32(1.2, { doc: 'Jitter of every line, in pixels at 1080p', min: 0, max: 64 }),
    tear: uniform.f32(18, { doc: 'Sideways jump of the torn lines, in pixels at 1080p', min: 0, max: 128 }),
    split: uniform.f32(2.5, { doc: 'Red/blue split, in pixels at 1080p', min: 0, max: 32 }),
    scan: uniform.f32(0.25, { doc: 'How dark the scanlines get', min: 0, max: 1 }),
    roll: uniform.f32(2.5, { doc: 'Seconds the bright band takes to roll down the screen', min: 0.2, max: 20 }),
    rollWidth: uniform.f32(0.18, { doc: 'Rolling band height, in screen units', min: 0.01, max: 1 }),
    glow: uniform.f32(0.2, { doc: 'Extra brightness inside the rolling band', min: 0, max: 1 }),
  },
  post: ({ shift, tear, split, scan, roll, rollWidth, glow }) => {
    const uv = screenUV(); // y-down: 0 is the top edge
    const px = postSize().y.div(1080);
    const t = time();

    // Rolling band, from above the top to below the bottom, then again.
    const centre = fract(t.div(roll)).mul(rollWidth.mul(2).add(1)).sub(rollWidth);
    const band = smoothstep(0, rollWidth, abs(uv.y.sub(centre))).mul(-1).add(1);

    // Every line wobbles; a few thin strips (where a slow wave peaks) jump sideways.
    const wobble = sin(uv.y.mul(260).add(t.mul(45))).mul(shift);
    const torn = step(0.96, sin(uv.y.mul(9).add(t.mul(2.3))).mul(sin(uv.y.mul(23).sub(t.mul(5.1)))));
    const jump = sin(t.mul(31).add(uv.y.mul(40))).mul(tear).mul(torn);
    const dx = wobble.add(jump).add(band.mul(shift).mul(2)).mul(px);

    const at = uv.add(vec2(dx, 0).mul(postTexel()));
    const off = vec2(split.mul(px).mul(band.add(1)), 0).mul(postTexel());
    const r = postColor(at.add(off)).x;
    const g = postColor(at).y;
    const b = postColor(at.sub(off)).z;

    const lines = sin(uv.y.mul(postSize().y).mul(1.6)).mul(0.5).add(0.5);
    const shade = lines.mul(scan).mul(-1).add(1);
    const lift = clamp(band.mul(glow).add(1), 1, 2);
    return vec3(r, g, b).mul(shade).mul(lift);
  },
});
