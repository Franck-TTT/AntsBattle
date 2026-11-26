// id game/ui-frames: the meta UI's outlines and glows match ui/frames.json (textures and documents).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineCheck } from '@gameengine/tools';
import { SPEC_FILE, docProblems, glowLayout, gmetaGuid, gmetaSlicing, parseSpec, pngSize, ringLayout, textureFile, type TextureLayout, type UiDoc } from './ui-frames.ts';

export const uiFramesCheck = defineCheck({
  name: 'ui-frames',
  description: 'UI outlines and glows match ui/frames.json: texture sizes and slicing, element heights, face radii, ring and glow layers',
  run(ctx) {
    const text = ctx.read(SPEC_FILE);
    if (text === null) return;
    const spec = parseSpec(text);
    const fix = '; run `gameengine tool ui-frames`';
    for (const [name, f] of Object.entries(spec.frames)) {
      const texture = (kind: 'rim' | 'glow', want: TextureLayout) => {
        const file = textureFile(kind, name);
        const meta = ctx.read(`${file}.gmeta`);
        let size: { width: number; height: number } | null = null;
        try {
          size = pngSize(readFileSync(join(ctx.project, file)));
        } catch {
          return ctx.fail(`${file} is missing${fix}`, { file: SPEC_FILE });
        }
        if (!size || size.width !== want.width || size.height !== want.height) {
          ctx.fail(`${file} is ${size?.width}x${size?.height}, frame ${name} needs ${want.width}x${want.height}${fix}`, { file });
        }
        const s = gmetaSlicing(meta);
        if (s.border.x !== want.border.x || s.border.y !== want.border.y || s.body !== want.body) {
          ctx.fail(`${file}.gmeta slices ${s.border.x}/${s.border.y} body ${s.body}, frame ${name} needs ${want.border.x}/${want.border.y} body ${want.body}${fix}`, { file: `${file}.gmeta` });
        }
        return gmetaGuid(meta);
      };
      const ringGuid = f.stroke > 0 ? texture('rim', ringLayout(f)) ?? null : null;
      const glowGuid = f.glow > 0 ? texture('glow', glowLayout(f)) ?? null : null;
      for (const use of f.uses) {
        const file = `ui/docs/${use.doc}.ui.json`;
        const docText = ctx.read(file);
        if (docText === null) {
          ctx.fail(`${SPEC_FILE}: frame ${name} uses ${use.doc}, which has no document`, { file: SPEC_FILE });
          continue;
        }
        for (const p of docProblems(JSON.parse(docText) as UiDoc, name, f, use, ringGuid, glowGuid)) ctx.fail(p + fix, { file });
      }
    }
  },
});
