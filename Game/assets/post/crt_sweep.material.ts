/**
 * CRT glitch band: every `period` seconds a band of horizontal jitter, colour split and brighter
 * scanlines sweeps the screen from top to bottom in `sweep` seconds. Driven by time() alone, so it
 * needs no game code. Runs over the UI (stage `overlay`).
 */
import { abs, clamp, fract, material, postColor, postSize, postTexel, screenUV, sin, smoothstep, time, uniform, vec2, vec3 } from '@gameengine/materials';

export default material('CrtSweep', {
  domain: 'post',
  stage: 'overlay',
  params: {
    period: uniform.f32(10, { doc: 'Seconds between two sweeps', min: 1, max: 60 }),
    sweep: uniform.f32(1.2, { doc: 'Seconds the band takes to cross the screen', min: 0.1, max: 10 }),
    width: uniform.f32(0.05, { doc: 'Band height, in screen units', min: 0.01, max: 1 }),
    shift: uniform.f32(2.5, { doc: 'Horizontal jitter inside the band, in pixels at 1080p', min: 0, max: 64 }),
    split: uniform.f32(0.75, { doc: 'Red/blue split inside the band, in pixels at 1080p', min: 0, max: 32 }),
    glow: uniform.f32(0.04, { doc: 'Extra brightness inside the band', min: 0, max: 1 }),
  },
  post: ({ period, sweep, width, shift, split, glow }) => {
    const uv = screenUV(); // y-down: 0 is the top edge
    // Seconds since this cycle's sweep started; the band starts above the top and ends below the bottom.
    const t = fract(time().div(period)).mul(period);
    const centre = t.div(sweep).mul(width.mul(2).add(1)).sub(width);
    const band = smoothstep(0, width, abs(uv.y.sub(centre))).mul(-1).add(1);

    const px = postSize().y.div(1080);
    const jitter = sin(uv.y.mul(220).add(time().mul(40))).mul(shift).mul(px).mul(band);
    const sp = split.mul(px).mul(band);
    const at = uv.add(vec2(jitter, 0).mul(postTexel()));
    const off = vec2(sp, 0).mul(postTexel());

    const r = postColor(at.add(off)).x;
    const g = postColor(at).y;
    const b = postColor(at.sub(off)).z;
    const scan = sin(uv.y.mul(postSize().y).mul(1.6)).mul(0.5).add(0.5);
    const lift = clamp(band.mul(glow).mul(scan.mul(0.5).add(0.5)).add(1), 1, 2);
    return vec3(r, g, b).mul(lift);
  },
});
