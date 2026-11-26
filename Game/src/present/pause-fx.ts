/**
 * Pause look: while the settings or weapon info popup pauses the run, an exaggerated CRT effect
 * (assets/post/crt_pause.material.ts) covers the game and the HUD/menu, but not the popup.
 *
 * How: the HUD and the level menu are pushed with `order: 0` (src/ui/game.ui.tsx), the popups with
 * no order (drawn over every camera). The scene's "Post camera" (order 1, draws nothing) sits
 * between them. While paused, the frame's post profile moves from the main camera to the post
 * camera, set to neon_pause.post.json: views under a camera with a post profile draw into the
 * scene and get its effects, the popups draw after them, sharp. Not paused, the post camera has
 * no profile, so the HUD draws after post as before (no bloom on the UI). Swapping profiles,
 * because post.set does not reach post effects on engine 0.1.43 (src/post-profile.ts).
 * Presentation only: reads the popups' sim state, writes only the cameras.
 */
import { assetKey, Camera, defineSystem, query, read, write } from '@gameengine/runtime';
import { SettingsMenu, WeaponInfo } from '../schema.gen.ts';

/** neon.post.json and neon_pause.post.json, by GUID. */
const NORMAL = '6e210f72-6c34-4729-9650-eb640d9b8c4b';
const PAUSED = '19614962-c007-4bbf-b462-64da8fcf7467';
/** Camera.order of the scene's main camera and of its "Post camera". */
const MAIN_ORDER = 0;
const POST_ORDER = 1;

export const PauseFx = defineSystem({
  name: 'PauseFx',
  stage: 'LateUpdate',
  queries: { cameras: query(write(Camera)) },
  resources: [read(SettingsMenu), read(WeaponInfo)],
  run(ctx, q) {
    const s = ctx.local(() => ({ on: false }));
    const on = !!(ctx.resource(SettingsMenu).open[0] || ctx.resource(WeaponInfo).open[0]);
    if (on === s.on) return;
    s.on = on;
    for (const c of q.cameras.chunks()) {
      const cam = c.col(Camera);
      for (let i = 0; i < c.length; i++) {
        const order = cam.order[i]!;
        const key = assetKey(cam.postProfile[i]!);
        if (order === MAIN_ORDER && (key === NORMAL || key === null)) c.set(Camera, i, { postProfile: on ? null : NORMAL });
        else if (order === POST_ORDER && (key === PAUSED || key === null)) c.set(Camera, i, { postProfile: on ? PAUSED : null });
      }
    }
  },
});
