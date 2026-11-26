/**
 * Post effects driven by the balancing sheet: pushes the General parameters' chromatic aberration
 * values to the `chromaticEdges` effect (assets/post/neon.post.json) whenever they change (start,
 * hot reload, a live tweak from the General Params widget). Presentation only.
 */
import { defineSystem, post } from '@gameengine/runtime';
import { CA_INNER, CA_OUTER, CA_STRENGTH } from '../balance.ts';

export const PostFromSheet = defineSystem({
  name: 'PostFromSheet',
  stage: 'LateUpdate',
  run(ctx) {
    const s = ctx.local(() => ({ applied: '' }));
    const key = `${CA_STRENGTH};${CA_INNER};${CA_OUTER}`;
    if (key === s.applied) return;
    s.applied = key;
    post.set('chromaticEdges', { values: { strength: CA_STRENGTH, inner: CA_INNER, outer: CA_OUTER } });
  },
});
