# 3D meshes in a ported ad

`MeshRenderer` is presentation: the slice keeps it, the hash ignores it, and `web/` draws it with
`createRenderer3D` (WebGL; no three.js, ~10 kB gzipped):

```ts
import { createRenderer3D } from '@gameengine/playable';
import { fileBytes } from '@gameengine/playable';
import { aliases, files } from 'playable:manifest'; // .glb and .mat.json assets listed in playable.json, packed: fileBytes(files[id])
const r = createRenderer3D({ meshes, materials, images, shaders }); // decode `files` into these
await r.ready;
// each frame, after p.render(alpha): draw at the stage's pixel size, then composite under the HUD
r.draw(p.world, { width: stage.canvas.width, height: stage.canvas.height, time });
stage.ctx.drawImage(r.canvas, 0, 0);
```

- **Drawn:** the lowest-order visible `Camera` (perspective or orthographic, `layerMask`), each
  `MeshRenderer` at its `WorldTransform` (built-in cube, sphere, plane, cylinder, torus, or a GLB
  `"file.glb"`/`"file.glb#Mesh"`), the first directional `Light`, `Environment` ambient, and
  `*.mat.json` materials (PBR approximated, unlit, toon, matcap; opaque, mask and blend).
- **Custom materials:** a `*.material.ts` needs its WGSL ported to a GLSL `vec4 surface()` passed as
  `shaders['x.material.ts']`. It reads `v_world`, `v_normal`, `v_uv`, `u_color`, `u_instance`
  (`MaterialParams.params`; both per-instance varyings, so never declare them as uniforms), `u_globals[8]` (`MaterialGlobals.v0..v7`), `u_time`, the light and
  camera, and each material parameter as `p_<name>`. A LateUpdate system writing
  `MaterialGlobals` (a moving hole) reaches the shader as in the engine.
- **Meshes:** GLB with embedded images, triangle lists only; Draco is refused. `playable.json`
  `export.meshes` decides what the build does to them: `"strip"` (default, lossless: drops tangents,
  colours and other data the renderer never reads), `"quantize"` (8-bit normals, 16-bit UVs, about
  25 % smaller inline), `"meshopt"` (also `EXT_meshopt_compression`, about 55 % smaller) or
  `"source"`. Skinned, animated or morphing models are copied as they are (the build notes say so).
  Code in `web/` that reads GLBs itself (shadows, culling) must use `readGlb` or `parseGlb` from
  `@gameengine/playable` before you pick `"meshopt"`. Heavy models still go to the ad's own
  `assets/` (read before the game's) decimated with smaller textures. The build deflates `files`.
- **Draw calls:** the renderer instances: every `MeshRenderer` of one mesh part and material draws
  in one call, so many copies of a few props are cheap; many distinct materials or `.glb#Mesh`
  parts are not.
- **Params:** only the params a `.mat.json` lists become uniforms; fill the rest from the
  `*.material.ts` defaults in `web/` before passing materials to the renderer.
- `samples/orbit-garden/playable-ads/garden-orbit` is the worked example (a hole-cut ground shader
  moved through `MaterialGlobals`).
