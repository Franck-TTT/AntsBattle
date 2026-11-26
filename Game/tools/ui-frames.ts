// UI frames: the outlines (rings) and glows of the meta UI, drawn from one spec (ui/frames.json).
// Shared by the ui-frames tool (draws the textures, fixes the documents) and the ui-frames check
// (fails when a document or a texture no longer matches the spec).
//
// Why textures: UI document elements have no border or box-shadow. A frame is three layers on one
// box: the glow under the face (it overhangs by `glow` px through its .gmeta body), the face (the
// element's own background, filling the box), and the ring drawn over the face's edge. Drawing the
// ring over the same box, instead of padding a face inside a coloured element, keeps the outline
// even: a 5 px pad lands on 2.5 screen pixels on a phone and rounds to 3 on one side, 2 on the other.
//
// Why fixed heights: a texture is exact only at the size it was drawn for. Framed elements have a
// fixed height, so a ring or glow is never stretched vertically; widths vary and are 9-sliced.
// Panels whose height follows their content ("auto") are 9-sliced on both axes.
import { deflateSync } from 'node:zlib';

export const SPEC_FILE = 'ui/frames.json';
export const TEXTURE_DIR = 'assets/ui/meta';
export const imageKey = (kind: 'rim' | 'glow', name: string) => `ui/meta/${kind}_${name}`;
export const textureFile = (kind: 'rim' | 'glow', name: string) => `${TEXTURE_DIR}/${kind}_${name}.png`;

export interface FrameUse {
  doc: string;
  /** The framed element: carries the fixed height, holds the glow, the face and the ring. */
  element: string;
  /** Its child that paints the background (rounded to the frame's radius, filling the box). */
  face: string;
}

export interface FrameSpec {
  radius: number;
  /** Outline width, px; 0: no ring. */
  stroke: number;
  /** Glow spread past the box, px; 0: no glow. */
  glow: number;
  /** The element's height, px, or "auto" for panels that size to their content. */
  height: number | 'auto';
  uses: FrameUse[];
}

export interface Spec {
  frames: Record<string, FrameSpec>;
}

export function parseSpec(text: string): Spec {
  const spec = JSON.parse(text) as Spec;
  for (const [name, f] of Object.entries(spec.frames)) {
    if (!(f.radius > 0)) throw new Error(`${SPEC_FILE}: ${name}.radius must be above 0`);
    if (f.height !== 'auto' && f.height < 2 * f.radius) throw new Error(`${SPEC_FILE}: ${name}.height ${f.height} is below twice its radius (${2 * f.radius})`);
    if (f.stroke < 0 || f.glow < 0) throw new Error(`${SPEC_FILE}: ${name}: stroke and glow are 0 or more`);
  }
  return spec;
}

/** What a texture must be: its size and its .gmeta slicing. */
export interface TextureLayout {
  width: number;
  height: number;
  border: { x: number; y: number };
  body: number;
}

export function ringLayout(f: FrameSpec): TextureLayout {
  const fixed = f.height !== 'auto';
  return {
    width: 2 * f.radius + 8,
    height: fixed ? (f.height as number) : 2 * f.radius + 8,
    border: { x: f.radius, y: fixed ? 0 : f.radius },
    body: 0,
  };
}

export function glowLayout(f: FrameSpec): TextureLayout {
  const fixed = f.height !== 'auto';
  const core = f.radius + f.glow;
  return {
    width: 2 * core + 8,
    height: fixed ? (f.height as number) + 2 * f.glow : 2 * core + 8,
    border: { x: core, y: fixed ? 0 : core },
    body: f.glow,
  };
}

/** Signed distance from (x, y) to a rounded rectangle [x0, x1] × [y0, y1] with corner radius r (negative inside). */
function roundRectDistance(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): number {
  const px = Math.abs(x - (x0 + x1) / 2) - ((x1 - x0) / 2 - r);
  const py = Math.abs(y - (y0 + y1) / 2) - ((y1 - y0) / 2 - r);
  return Math.hypot(Math.max(px, 0), Math.max(py, 0)) + Math.min(Math.max(px, py), 0) - r;
}

const SAMPLES = 4;

/** White RGBA pixels with a computed alpha, `SAMPLES`² supersampled. */
function paint(width: number, height: number, alpha: (x: number, y: number) => number): Uint8Array {
  const out = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let a = 0;
      for (let sy = 0; sy < SAMPLES; sy++) for (let sx = 0; sx < SAMPLES; sx++) a += alpha(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES);
      const i = (y * width + x) * 4;
      out[i] = out[i + 1] = out[i + 2] = 255;
      out[i + 3] = Math.round((255 * a) / (SAMPLES * SAMPLES));
    }
  }
  return out;
}

/** The ring: the band between the box's outline and the same outline inset by `stroke`. */
export function drawRing(f: FrameSpec): { layout: TextureLayout; rgba: Uint8Array } {
  const layout = ringLayout(f);
  const { width: w, height: h } = layout;
  const r = f.radius;
  const s = f.stroke;
  const rgba = paint(w, h, (x, y) => {
    const outer = roundRectDistance(x, y, 0, 0, w, h, r);
    const inner = roundRectDistance(x, y, s, s, w - s, h - s, Math.max(0, r - s));
    return outer <= 0 && inner > 0 ? 1 : 0;
  });
  return { layout, rgba };
}

/** The glow: full under the box (hidden by the face), then a gaussian falloff over `glow` px. */
export function drawGlow(f: FrameSpec): { layout: TextureLayout; rgba: Uint8Array } {
  const layout = glowLayout(f);
  const { width: w, height: h } = layout;
  const m = f.glow;
  const sigma = m / 2;
  const rgba = paint(w, h, (x, y) => {
    const d = roundRectDistance(x, y, m, m, w - m, h - m, f.radius);
    return d <= 0 ? 1 : Math.exp(-((d / sigma) ** 2));
  });
  return { layout, rgba };
}

// ---- PNG ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const header = new Uint8Array(13);
  const hv = new DataView(header.buffer);
  hv.setUint32(0, width);
  hv.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Width and height from a PNG's header. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || bytes[0] !== 137 || bytes[1] !== 80) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

// ---- .gmeta and documents ----

export const gmetaBorder = (l: TextureLayout) => `border={ left = ${l.border.x}, right = ${l.border.x}, top = ${l.border.y}, bottom = ${l.border.y} }`;
export const gmetaBody = (l: TextureLayout) => `body={ left = ${l.body}, right = ${l.body}, top = ${l.body}, bottom = ${l.body} }`;

/** The GUID a texture's .gmeta gives it, or null. */
export function gmetaGuid(text: string | null): string | null {
  return text?.match(/guid\s*=\s*"([^"]+)"/)?.[1] ?? null;
}

/** The border and body a .gmeta sets (0 when absent). */
export function gmetaSlicing(text: string | null): { border: { x: number; y: number }; body: number } {
  const num = (block: string | undefined, side: string) => Number(block?.match(new RegExp(`${side}\\s*=\\s*(\\d+)`))?.[1] ?? 0);
  const border = text?.match(/^border\s*=\s*\{([^}]*)\}/m)?.[1];
  const body = text?.match(/^body\s*=\s*\{([^}]*)\}/m)?.[1];
  return { border: { x: num(border, 'left'), y: num(border, 'top') }, body: num(body, 'left') };
}

interface DocNode {
  type: string;
  style?: Record<string, unknown>;
  children?: string[];
}
export interface UiDoc {
  nodes: Record<string, DocNode>;
}

/** The child of `element` showing the texture with this GUID, or null. */
export function layerWithImage(doc: UiDoc, element: string, guid: string | null): string | null {
  if (!guid) return null;
  for (const id of doc.nodes[element]?.children ?? []) {
    const image = doc.nodes[id]?.style?.image as { guid?: string } | undefined;
    if (image?.guid === guid) return id;
  }
  return null;
}

/** The style a ring or glow layer needs: the element's box, unscaled slices, out of the flow. */
export const LAYER_STYLE: Record<string, string> = {
  w: '100%',
  h: '100%',
  sliceScale: '1',
  position: 'anchored',
  anchor: '0.5 0.5',
  pivot: '0.5 0.5',
  attach: 'true',
  pad: '0',
};

const norm = (v: unknown) => String(v ?? '').replace(/[\s,]+/g, ' ').trim();
const same = (a: unknown, b: string) => norm(a) === norm(b);

/** What is wrong with a framed element in its document (empty: it matches the spec). */
export function docProblems(doc: UiDoc, name: string, f: FrameSpec, use: FrameUse, ringGuid: string | null, glowGuid: string | null): string[] {
  const out: string[] = [];
  const el = doc.nodes[use.element];
  const face = doc.nodes[use.face];
  const where = `${use.doc}/${use.element}`;
  if (!el) return [`${where}: no such layer`];
  if (!face) return [`${use.doc}/${use.face}: no such layer (the face of frame ${name})`];
  if (f.height !== 'auto' && Number(el.style?.h) !== f.height) out.push(`${where}: height ${String(el.style?.h ?? 'auto')}, frame ${name} is drawn for ${f.height}`);
  if (Number(face.style?.radius) !== f.radius) out.push(`${use.doc}/${use.face}: radius ${String(face.style?.radius ?? 0)}, frame ${name} is drawn for ${f.radius}`);
  if (f.height !== 'auto' && face.style?.h !== '100%') out.push(`${use.doc}/${use.face}: must fill the element's height (h=100%)`);
  if (f.stroke > 0 && Number(el.style?.pad ?? 0) !== 0) out.push(`${where}: pad must be 0 (the ring draws the outline over the face)`);
  const check = (kind: 'ring' | 'glow', guid: string | null, wanted: boolean) => {
    const id = layerWithImage(doc, use.element, guid);
    if (!wanted) return;
    if (!id) return out.push(`${where}: no ${kind} layer showing ${imageKey(kind === 'ring' ? 'rim' : 'glow', name)}`);
    const st = doc.nodes[id]!.style ?? {};
    for (const [k, v] of Object.entries(LAYER_STYLE)) {
      if (k === 'sliceScale' && (st.sliceScale === undefined || Number(st.sliceScale) === 1)) continue;
      if (!same(st[k], v)) out.push(`${use.doc}/${id}: ${k} is ${String(st[k] ?? 'unset')}, a ${kind} layer needs ${v}`);
    }
    const kids = el.children ?? [];
    const order = kids.indexOf(id) - kids.indexOf(use.face);
    if (kind === 'ring' && order < 0) out.push(`${use.doc}/${id}: the ring must come after the face (drawn over it)`);
    if (kind === 'glow' && order > 0) out.push(`${use.doc}/${id}: the glow must come before the face (drawn under it)`);
  };
  check('ring', ringGuid, f.stroke > 0);
  check('glow', glowGuid, f.glow > 0);
  return out;
}
