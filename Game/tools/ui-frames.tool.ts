// Draws the meta UI's outlines and glows from ui/frames.json and makes the documents match.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineTool } from '@gameengine/tools';
import {
  LAYER_STYLE,
  SPEC_FILE,
  drawGlow,
  drawRing,
  encodePng,
  gmetaBody,
  gmetaBorder,
  gmetaGuid,
  imageKey,
  layerWithImage,
  parseSpec,
  textureFile,
  type FrameSpec,
  type FrameUse,
  type UiDoc,
} from './ui-frames.ts';

export const uiFrames = defineTool({
  name: 'ui-frames',
  description:
    'Draws the meta UI outlines (rings) and glows from ui/frames.json into assets/ui/meta/rim_<name>.png and glow_<name>.png with their .gmeta slicing, then sets the listed UI document elements to match (fixed height, face radius, ring and glow layers sized to the element, ring over the face, glow under it). Writes those textures and documents. Use after changing a radius, an outline width, a glow spread or a height in ui/frames.json, or after adding a frame. Leaves colours, opacity and states to the documents.',
  params: {
    frame: { type: 'string', description: 'Only this frame (a name in ui/frames.json); default: all' },
  },
  required: [],
  async run(args, ctx) {
    const spec = parseSpec(readFileSync(join(ctx.project, SPEC_FILE), 'utf8'));
    const names = args.frame ? [args.frame] : Object.keys(spec.frames);
    for (const n of names) if (!spec.frames[n]) throw new Error(`${SPEC_FILE} has no frame "${n}"`);

    // 1. Textures.
    const written: string[] = [];
    const draw = (kind: 'rim' | 'glow', name: string, f: FrameSpec) => {
      const { layout, rgba } = kind === 'rim' ? drawRing(f) : drawGlow(f);
      const file = join(ctx.project, textureFile(kind, name));
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, encodePng(layout.width, layout.height, rgba));
      written.push(textureFile(kind, name));
      return layout;
    };
    const layouts: { file: string; border: string; body: string }[] = [];
    for (const name of names) {
      const f = spec.frames[name]!;
      if (f.stroke > 0) {
        const l = draw('rim', name, f);
        layouts.push({ file: textureFile('rim', name), border: gmetaBorder(l), body: gmetaBody(l) });
      }
      if (f.glow > 0) {
        const l = draw('glow', name, f);
        layouts.push({ file: textureFile('glow', name), border: gmetaBorder(l), body: gmetaBody(l) });
      }
    }
    // New textures get their .gmeta (and GUID) from validate, then their slicing.
    if (layouts.some((l) => !existsSync(join(ctx.project, `${l.file}.gmeta`)))) await ctx.cli(['validate']).catch(() => undefined);
    for (const l of layouts) await ctx.cli(['gmeta', 'set', l.file, l.border, l.body]);

    // 2. Documents.
    const guid = (kind: 'rim' | 'glow', name: string) => {
      const p = join(ctx.project, `${textureFile(kind, name)}.gmeta`);
      return existsSync(p) ? gmetaGuid(readFileSync(p, 'utf8')) : null;
    };
    const readDoc = (doc: string) => JSON.parse(readFileSync(join(ctx.project, 'ui/docs', `${doc}.ui.json`), 'utf8')) as UiDoc;
    const set = (doc: string, layer: string, fields: Record<string, string | number>) =>
      ctx.cli(['ui', 'doc', 'set', doc, layer, ...Object.entries(fields).map(([k, v]) => `${k}=${v}`)]);
    const edited: string[] = [];

    const fit = async (name: string, f: FrameSpec, use: FrameUse) => {
      let doc = readDoc(use.doc);
      if (!doc.nodes[use.element] || !doc.nodes[use.face]) throw new Error(`${use.doc}: frame ${name} lists ${use.element} / ${use.face}, which it does not have`);
      const fixed = f.height !== 'auto';
      await set(use.doc, use.element, { radius: f.radius, ...(fixed ? { h: f.height as number } : {}), ...(f.stroke > 0 ? { bg: '#00000000', pad: 0 } : {}) });
      const hasWidth = doc.nodes[use.element]!.style?.w !== undefined;
      await set(use.doc, use.face, { radius: f.radius, ...(fixed ? { h: '100%' } : {}), ...(hasWidth ? { w: '100%' } : {}) });

      const layer = async (kind: 'rim' | 'glow') => {
        const g = guid(kind, name);
        let id = layerWithImage(doc, use.element, g);
        if (!id) {
          id = `${use.element}_${kind === 'rim' ? 'ring' : 'glow'}`;
          await ctx.cli(['ui', 'doc', 'add', use.doc, 'element', '--parent', use.element, '--id', id, '--set', 'tint=#ffffffff', '--set', 'tintMode=multiply', ...(kind === 'glow' ? ['--set', 'imageAlpha=0.6'] : [])]);
        }
        await set(use.doc, id, { image: imageKey(kind, name), ...LAYER_STYLE });
        return id;
      };
      const glowId = f.glow > 0 ? await layer('glow') : null;
      const ringId = f.stroke > 0 ? await layer('rim') : null;

      // The glow first (under the face), the ring right after the face (over it, under badges).
      if (glowId) await ctx.cli(['ui', 'doc', 'move', use.doc, glowId, '--parent', use.element, '--index', '0']);
      if (ringId) {
        doc = readDoc(use.doc);
        const kids = doc.nodes[use.element]!.children ?? [];
        const target = kids.indexOf(use.face) + (kids.indexOf(ringId) > kids.indexOf(use.face) ? 1 : 0);
        if (kids.indexOf(ringId) !== kids.indexOf(use.face) + 1) await ctx.cli(['ui', 'doc', 'move', use.doc, ringId, '--parent', use.element, '--index', String(target)]);
      }
      edited.push(`${use.doc}/${use.element}`);
    };
    for (const name of names) for (const use of spec.frames[name]!.uses) await fit(name, spec.frames[name]!, use);

    ctx.log(`${written.length} texture(s), ${edited.length} element(s)`);
    return { textures: written, elements: edited };
  },
});
