// The General parameters that drive post effects are written into the post profile itself
// (assets/post/neon.post.json, effects `chromaticEdges` and `crtSweep`): on engine 0.1.43 neither
// post.set nor MaterialGlobals reach post materials, while the profile's `values` do and hot reload.
// Written by `gameengine tool sheet-sync` (sheet values, live tweaks on top) and by the editor's
// General Params widget; the game/balance-sheet check fails when the profile disagrees.
// Pure functions only: no runtime import, so tools and editor widgets can use it.
import type { BalanceSheet } from './balance.sheet.ts';

type General = BalanceSheet['general'];

export const POST_PROFILE = 'assets/post/neon.post.json';
export const CA_EFFECT = 'chromaticEdges';
export const CRT_EFFECT = 'crtSweep';
/** The General parameters the profile holds. */
export const POST_KEYS = [
  'caStrength', 'caInner', 'caOuter', 'caInsetTop', 'caInsetBottom', 'caInsetLeft', 'caInsetRight',
  'crtPeriod', 'crtSweep', 'crtWidth', 'crtShift', 'crtSplit', 'crtGlow',
] as const satisfies readonly (keyof General)[];
type PostParams = Pick<General, (typeof POST_KEYS)[number]>;

/** The `values` string the chromatic aberration effect gets for these General parameters. */
export function chromaticValues(g: PostParams): string {
  return (
    `strength=${g.caStrength}; inner=${g.caInner}; outer=${g.caOuter}; ` +
    `insetTop=${g.caInsetTop}; insetBottom=${g.caInsetBottom}; insetLeft=${g.caInsetLeft}; insetRight=${g.caInsetRight}`
  );
}

/** The `values` string the CRT sweep effect gets for these General parameters. */
export function crtValues(g: PostParams): string {
  return `period=${g.crtPeriod}; sweep=${g.crtSweep}; width=${g.crtWidth}; shift=${g.crtShift}; split=${g.crtSplit}; glow=${g.crtGlow}`;
}

/** The profile text with each effect's `values` set; null when it already has them (nothing to write). */
export function withPostValues(profileText: string, g: PostParams): string | null {
  const profile = JSON.parse(profileText) as { effects?: Record<string, { values?: string }> };
  let changed = false;
  for (const [id, values] of [[CA_EFFECT, chromaticValues(g)], [CRT_EFFECT, crtValues(g)]] as const) {
    const effect = profile.effects?.[id];
    if (!effect) throw new Error(`${POST_PROFILE} has no "${id}" effect`);
    if (effect.values === values) continue;
    effect.values = values;
    changed = true;
  }
  return changed ? `${JSON.stringify(profile, null, 2)}\n` : null;
}
