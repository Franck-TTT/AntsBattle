# Photoshop (PSD) import

Artists who lay a character out in Photoshop can skip Spine's own PSD step: `gameengine import
psd` reads the `.psd`/`.psb` and applies **Spine's layer tags** (same names and meaning as Spine's
Import PSD), writing a PNG per layer under `assets/<images>` and a `*.skeleton2d.json`.

```sh
gameengine import psd art/kid.psd                          # new skeleton assets/kid.skeleton2d.json, images under assets/kid/
gameengine import psd art/kid.psd --dry-run --json         # what every layer becomes; writes nothing
gameengine import psd art/kid.psd --scale 0.5 --padding 2 --no-trim --exclude-hidden
gameengine import psd art/kid.psd --skeleton assets/kid.skeleton2d.json --prune   # reimport
```

In the editor: **Animation 2D → Tree → New → Import PSD…** (or the palette, or drop the `.psd`
on the Project panel). The dialog previews each layer with its tags and outcome before importing.

| Tag | Effect |
|---|---|
| `[bone]` / `[bone:name]` | the group (or layer) gets a bone at the centre of its first visible layer; an existing bone keeps its position |
| `[slot]` / `[slot:name]` | the group's layers share one slot (it shows the first visible one) |
| `[skin]` / `[skin:name]` | the group's layers are skin placeholders; images go under `<skin>/` |
| `[folder]` / `[folder:a/b]` | prefixes attachment names and image paths (`/x` starts over) |
| `[mesh]` / `[mesh:name]` | a mesh whose hull is traced from the layer's alpha (Spine's Trace; a fully opaque rectangle stays its 4 corners), or a linked mesh of the mesh whose path ends with `name` |
| `[merge]` | the group becomes one image (normal, multiply, screen, linear dodge composited) |
| `[overlay]` | drawn into every layer below it, inside their pixels; no image of its own |
| `[origin]` | this layer's centre is the skeleton's 0,0 (else the first guides, else the canvas centre) |
| `[trim]`, `[trim:false\|canvas\|mask]` | trim to pixels, keep the canvas size, or cut to the layer mask |
| `[ignore]` | skipped with its children |
| `[path:file]`, `[name:n]` | the image file name, the attachment name |
| `[scale:n]`, `[pad:n]`, `[rotate:90]` | image resolution, padding and quarter turns; the attachment compensates so it looks the same |
| `[bones]`, `[slots]`; `[!bone]`, `[!slot]`, `[!name]`, `[!path]` | tag every immediate child; opt a child out |

A value with `*` on a group is a pattern for its children (`[slot:*-s]`). Layer opacity becomes the
attachment's alpha; Normal/Multiply/Screen/Linear Dodge become the slot's blend.

**Reimport** (`--skeleton`, Spine 4.3's behaviour): images, region placement and new layers
update; bone positions, animations, and mesh vertices and weights stay. `--prune` removes the
attachments (with their keys and PNGs) whose images the PSD no longer makes — only images an
earlier PSD import made, when the skeleton records them (`source.images`).

**Refused or not applied:** 16/32-bit and CMYK/Lab/indexed documents (convert to 8-bit RGB);
layer effects, adjustment and fill layers, vector masks and Photoshop clipping masks are listed as
warnings (rasterise or merge them, or use `[overlay]`); other blend modes draw as Normal. Pixels
past the canvas edges are dropped, as Photoshop's own export drops them: a layer that bleeds off
the canvas becomes the image of its part on the canvas, placed there.
