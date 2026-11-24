---
name: spine-import
version: 1.9.0
tier: optional
description: Spine and PSD import and export — `gameengine import spine` (JSON and .skel, Spine 3.0 and 3.4 to 4.3), `import psd` for tagged Photoshop files, `export spine`, atlases, import warnings, rig cost on phones. Use when an animator hands over Spine files or a PSD, when re-importing, or when a rig must go back to Spine.
---

# Spine import

The engine plays 2D skeletons from its own format, `*.skeleton2d.json`. Spine files are **converted once** by the
optional importer; the game never reads Spine data at runtime. Spine 3.0, 3.4–3.8 and 4.0–4.3
JSON exports and 3.0 and 3.4–4.2 binary exports are supported; 3.1–3.3 exports are refused
(re-export from Spine 3.4 or newer), and so are 4.3 binaries (export JSON).

## Export from Spine

1. Spine → Export → **JSON** (binary works too for 3.0 and 3.4–4.2, e.g. the `.skel.bytes` a
   Unity project already has). "Nonessential data" is optional.
2. **Images: not packed.** Tick "Pack" off (or export the images folder separately): the engine
   packs its own atlases from loose images (skill `atlasing`). Put the images under
   `assets/<name>/`, keeping Spine's attachment paths (`goblin/left-arm.png`).
3. Already have a packed export (`hero.atlas` + `hero.png`)? Use `--atlas` below; it cuts every
   region back into a loose PNG. Prefer an atlas at scale 1 (the importer warns otherwise). A
   premultiplied-alpha (PMA, `pma: true`) atlas is un-premultiplied with a warning (soft, dark
   edges); add `--keep-pma` to keep it premultiplied: the skeleton gets
   `"premultipliedAlpha": true` and is drawn with Spine's PMA blending.

## Import

```sh
gameengine import spine art/hero-pro.json --out assets/chars/hero.skeleton2d.json --images chars/hero/
gameengine import spine art/hero-pro.json --atlas art/hero.atlas     # also unpack the atlas
gameengine import spine art/hero.skel.bytes --atlas art/hero.atlas --keep-pma   # binary, PMA kept
gameengine import spine art/hero-pro.json --json                     # machine-readable report
```

In the editor, **Animation 2D → Tree → New → Import Spine…** (or the palette's "Import Spine…",
or dropping the `.json`/`.skel` with its `.atlas` on the Project panel) runs the same command
with these options and shows the report, then opens the skeleton.

- JSON or binary is decided by the file's content. Defaults: name from the file
  (`hero-pro.json`, `hero.skel.bytes` → `hero`), output `assets/<name>.skeleton2d.json`
  inside a project, image prefix `<name>/` (so attachment `head` is `assets/hero/head.png`).
- One owner per rig. While the `.spine` project is the source, re-import after every Spine change
  and never edit the `.skeleton2d.json` (a re-import overwrites it). Once the team moves the rig
  to the engine, stop re-importing and edit it with `gameengine anim2d` (skill `animation-2d-agent`).
- Exit 2 with a message for 3.1–3.3 or non-Spine files.

## Spine 3.x exports (older games)

Import 3.0 and 3.4–3.8 exports as they are (`.json`, `.skel`, `.skel.bytes`); no re-export
needed, except for a 3.0 JSON with a transform constraint, which is refused. 3.1–3.3 exports are
refused: open the project in Spine 3.4 or newer and export again. The importer converts what
changed in Spine 4 instead of copying it:

- **Curves.** Spine 3 stores a key's bezier handles normalised to the segment (0..1); Spine 4
  stores them in seconds and values. Copied verbatim, every eased key pulls towards time 0 and
  value 0 and the rig "breathes". The importer denormalises them, and **warns** ("curves with time
  handles outside their key segment") when a file read as Spine 4 carries handles outside their
  segment: that is 3.x data under a 4.x version (or a hand-edited file). Re-export it, or fix
  `skeleton.spine` to the version that wrote it.
- **Rotations** turn the short way round between keys, as Spine 3 did.
- **3.0 and 3.4** bones with `inheritRotation`/`inheritScale` off get the nearest 3.5+ transform
  mode, with a warning: those bones land within a few pixels of Spine 3.0/3.4, not exactly.
  Re-export from 3.5+ for an exact match.
- **3.0** flipX/flipY bone keys and setup-pose bone flips are dropped with a warning: they have
  no 4.x form.

## Rig budgets and `--strip-unused`

Every import prints the rig's size (bones, slots, vertices when every slot shows its largest
attachment, attachments, images) and **warns when it is over the budget of a device class**
(`--device phone-low|phone|tablet|desktop`, default `phone`):

| Class | Bones | Slots | Vertices |
|---|---|---|---|
| phone-low | 64 | 48 | 1500 |
| phone | 100 | 80 | 3000 |
| tablet | 160 | 128 | 6000 |
| desktop | 256 | 256 | 20000 |

A rig made for another platform (hundreds of bones and animations) is caught here, not in the
frame time. Keep only what the game plays:

```sh
gameengine import spine art/rocket.skel.bytes --atlas art/rocket.atlas --strip-unused idle,launch,land --device phone-low
```

`--strip-unused` keeps the named animations and the attachments the setup pose or those
animations show (by name, in every skin), and drops the other animations and attachments; images
nothing draws any more are not unpacked from `--atlas` (without `--atlas` the report lists them to
delete). Bones, slots, bounding boxes and points stay: game code finds them by name. Bones and
slots over budget need fixing in Spine (or a split rig).

Size is half the story: **which features** a rig uses decides what it costs per frame. After the
import, run

```sh
gameengine anim2d metrics assets/chars/hero.skeleton2d.json --device phone-low   # estimate per instance, costliest features, what instead
gameengine anim2d problems assets/chars/hero.skeleton2d.json --device phone-low  # the same as warnings, with the import's other problems
```

The Spine features that cost most, measured on the engine (skill `animation-2d-agent`,
`references/performance.md`): **physics constraints** (every bone of a 100-bone rig at 60 Hz: ×21
the pose cost; one per chain root: ×4), **clipping** (CPU skinning and clipping, two draw calls per
instance when only some slots are clipped), **deform keys** (×2.6–4, and 32 bytes per vertex
uploaded every frame — Spine rigs often use them where weights would do), **transform** (×5) and
**path** (×4) constraints, and blend modes or two-colour tint alternating in draw order (a draw
call per change). Weighted meshes, premultiplied alpha, two-colour tint on every slot, skins and
sliders are cheap.

## What converts and plays

Clipping attachments (with 4.3 `convex`/`inverse`), image sequences (4.1+: every frame image —
`path` + zero-padded number — must exist as a sprite; `gameengine validate` names a missing frame),
sequence keys, linked meshes (kept as links: they share the source mesh and inherit its deform
and sequence keys, 4.3 cross-slot too) and two-colour tint (`dark`, `rgba2`/`rgb2`) import
without warnings and draw on every device tier. Clipping runs on the CPU: keep clip polygons
small (few edges, convex) and the clipped slots few and contiguous in draw order (clipping breaks
the draw into the CPU path and back: two extra draws per instance).

## Warnings: what is kept but not played

Every warning but the weight report names Spine data the engine does not evaluate. The data is
kept under `unsupported` in the file (nothing is dropped):

| Warning | Effect in the game | What to do |
|---|---|---|
| drawOrderFolder timelines (4.3) | those draw-order keys do not play | key the draw order on the animation instead |
| vertices weighted to more than 4 bones | the engine keeps each vertex's 4 largest weights, renormalised | if the report's largest dropped weight is above ~0.1, prune weights in Spine and re-export |

Path, physics and slider constraints, 4.3 transform constraints (any property mapping) and IK
`scaleY` modes import with their timelines and play (4.0–4.3 JSON, 4.0–4.2 binary). Physics is
presentation: the game's sim and its bone queries (`skeleton2DBone`) see the bones before
physics, the drawn skeleton swings (see the `skeleton-2d` skill). A 4.2 file's physics plays
with 4.3's maths (the importer writes 4.2's defaults out), which moves a little differently from
Spine 4.2's preview.

The weight report lists every affected attachment (`skin/slot/attachment`, influences dropped,
vertices affected, largest dropped weight); `--json` has it as `droppedWeights`.

Warnings about anything else are importer bugs: report them with the Spine file.

## Photoshop (PSD) import

Artists who lay a character out in Photoshop can import the PSD straight into a rig: `gameengine import psd art/kid.psd` (in the editor: **Animation 2D → Tree → New → Import PSD…**). Layer tags, reimport and what is refused: `references/psd-import.md`.

## Check the result

- `gameengine skel2d pose <file> --anim <a> --time <t> --json` prints bone world transforms,
  slot attachments and draw order for any pose (compare with Spine's preview).
- Curves, IK, transform, path and slider constraints, skins, events, deform and draw order keys
  import exactly; physics matches Spine 4.3's own loop within a thousandth of a pixel;
  the engine's importer is tested against the official Spine runtime on Spine's own examples.

## Back to Spine

`gameengine export spine assets/chars/hero.skeleton2d.json --out art/spine --version 4.2`
(or `4.3`; MCP `spine_export`) writes `art/spine/<name>.json`, Spine JSON with the loose images'
folder relative to it: in Spine, **Import Data** on that file. Everything the engine plays goes
back (constraints, skins, every attachment and timeline, curves exactly); what the chosen version
cannot hold is printed as a warning, never dropped silently (4.2: sliders, clipping
convex/inverse, IK `volume` and physics scaleY modes; cross-slot linked meshes become copies).
Engine-only data (`mixes`, `premultipliedAlpha`) has no place in Spine JSON and is reported.
Re-importing an export of the version the rig came from gives the same `*.skeleton2d.json` byte
for byte. Using exported data with Spine's own runtimes is subject to Spine's licence.
