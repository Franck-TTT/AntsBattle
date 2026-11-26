/**
 * Post effects driven by the balancing sheet: writes the General parameters' chromatic aberration
 * values into MaterialGlobals.v7 (strength, inner, outer, 1), which assets/post/chromatic_edges
 * reads with materialGlobal(7). Rewritten only when they differ (start, world rebuild, hot reload,
 * a live tweak from the General Params widget). Presentation only.
 *
 * Not post.set: in headless screenshots on engine 0.1.43, post.set showed no visible effect
 * (values, weight and enabled all ignored). Whether MaterialGlobals reach post materials is not
 * verified yet either.
 */
import { defineSystem, write, MaterialGlobals } from '@gameengine/runtime';
import { CA_INNER, CA_OUTER, CA_STRENGTH } from '../balance.ts';

const CA = [CA_STRENGTH, CA_INNER, CA_OUTER, 1].map(Math.fround);

export const PostFromSheet = defineSystem({
  name: 'PostFromSheet',
  stage: 'LateUpdate',
  resources: [write(MaterialGlobals)],
  run(ctx) {
    const v = ctx.resource(MaterialGlobals).v7; // slot 7: keep in sync with chromatic_edges.material.ts
    if (v[0] === CA[0] && v[1] === CA[1] && v[2] === CA[2] && v[3] === CA[3]) return;
    ctx.setField(MaterialGlobals, 'v7', [CA_STRENGTH, CA_INNER, CA_OUTER, 1]);
  },
});
