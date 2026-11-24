# Rigging a character for keyed clips, and working with Blender

## Rigging checklist

When you rig a model yourself (Blender, a generated mesh), these make `rig infer`, mirroring and
props work first time:

- **Root and hips:** one root bone at the origin pointing up (+Z in Blender), not deforming; the
  hips are its child. Everything else descends from the hips.
- **Names:** humanoid names with `.L`/`.R` (or `Left…`/`Right…`) on both sides, so `rig infer`
  pairs them and `mirror` works. Knees and elbows bend on one local axis. The reference
  humanoid's layout (`references/humanoid.md`: neck, shoulders, hands, feet and toes) is the
  set the base clips key; copy it when you build a skeleton.
- **Rest pose:** a T-pose or an A-pose, facing forward (+Z in glTF); `rig infer` gives the
  arms a `base` down to the reference pose.
- **Sockets:** a non-deforming bone per prop slot (hand, back), with +Y along the held item, for
  `BoneAttach` (skill `models-3d`).
- **Weights:** at most 4 per vertex, normalised; nothing weighted to the root or a socket.
- **Export:** glTF/GLB (or FBX) with the skin; `rig infer` then reads the result.

Automatic weights fail on generated meshes that are not manifold or have loose islands ("Bone
Heat Weighting: failed to find solution"). A recipe that works, in Blender: duplicate the mesh as
a proxy, voxel-remesh it (about 0.035 m), decimate to about 30%, keep only its largest connected
piece, parent it to the armature with automatic weights, then copy the weights to the real mesh
with a Data Transfer modifier (vertex groups, nearest face interpolated), limit to 4 per vertex
and normalise. Check the shoulders and hips by hand afterwards: the proxy's weights are coarse.

## Blender: a collaborator, not a requirement

Blender is free, and the **Blender MCP** server (free, open source) lets an agent drive it.
Use them together with this tool when the work is outside what keyed clips do well:

- dense motion: mocap cleanup, long hand-keyed performances, cloth or secondary motion baked to
  bones (export glTF/FBX and play it with `file#clip`, skill `models-3d`);
- props whose parts move as rigid pieces (a gate's wings, a lid, a lever): animate the objects'
  transforms and export glTF/GLB or FBX with no armature; the animated nodes become joints and an
  Animator plays the clips (skill `models-3d`, "Rigs and skinned meshes");
- modelling, rigging and skinning a new character, fixing weights or joint orientations;
- retargeting a clip between rigs with different joint names.

Check whether Blender and Blender MCP are already available (an `mcp__blender__*` tool, or
`blender --version`). **If they are not, ask the user whether they want them set up** before
installing anything; never install them unprompted. Keyed clips need neither. If the Blender
add-on reports an older protocol than the server, ask the user to reinstall the add-on from the
same server version and restart its server in Blender before relying on more than running code.
