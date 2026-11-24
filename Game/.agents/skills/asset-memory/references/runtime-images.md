# Images downloaded at run time

Art the game downloads (a port streaming the original game's hi-res map tiles, say) is drawn
without cooking it, when it is GPU block data:

```ts
import { net, textures } from '@gameengine/runtime';
const r = await net.fetchBytes(url, { timeoutMs: 30000 });
if (!r.ok) return; // keep showing the in-app low-res image
const key = textures.createCompressed('tile-12', { width: 1024, height: 1024, format: 'astc6x6', flipY: true }, r.bytes());
// <Sprite src={key} /> or a UI image; textures.destroy('tile-12') when it leaves the screen
```

- `createCompressed` takes raw block data. A Unity asset bundle is a container: a port reads the
  texture's blocks out of it first (the Unity port kit documents the format).
- ASTC 6x6, one mip; `flipY` for rows stored bottom-up (Unity's texture data). Data that
  arrives LZMA-packed (Unity bundle blocks) goes through `decompress(packed, { format: 'lzma', size })` first.
- At most 16 MB of blocks, 64 textures. A phone without ASTC holds them decoded (9x), so free
  what is off screen and keep showing the in-app low-res image until the key exists.
- It draws nothing until the renderer has uploaded it (a few a frame).
- Content the game hosts itself belongs in on-demand bundles instead (`bundles` in
  `project.gameengine.json`); this path is for data in a format the cook never saw.
