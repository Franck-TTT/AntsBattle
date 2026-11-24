# Memory pressure, evictions and the Android heap

- **Memory warnings** (Android `onTrimMemory`, iOS memory warnings): when memory is critically low, or the game is in the background and may be killed, the engine evicts every resident member of released groups that no loaded group pins, whatever the budget, and frees decoded sounds nothing holds (no voice, waiting trigger, loaded bank or group) — logged once as `freed N textures and meshes and M sounds of released asset groups, and K unused sounds` (category `memory`). Loaded groups are never touched, and neither are pools (they are sim state). A sound triggered outside any group or bank may be freed and decodes again on its next play: keep sounds that must never miss in a loaded group or bank. When the app is about to be killed (`TRIM_MEMORY_COMPLETE`) pending saves are flushed to storage as well.
- **On a device**, every eviction is an Info line in the log (logcat tag `gameengine`, category `memory`: `evicted '<key>' (<MB>) of released <groups> over the <class> budget`), and a member that fails to load again after an eviction is a Warn (`render`: `reload of evicted mesh|material|texture '<key>' failed: <why>`); both are rate-limited. A member whose load failed is tried again when a group holding it loads again.
- **Decoded copies leave once uploaded.** When the renderer has put a texture on the GPU, the engine frees that texture's decoded CPU copy at once (on an IO thread), which is hundreds of MB while a big map streams. The price: a page evicted and drawn again soon after is read and decoded again instead of coming from memory, so a quick return can show stand-ins for about a frame. Measure your own quick return on a `phone-low` device: evict a released area and go back to it within a second or two.

## Returning freed Android heap pages

Asset release removes engine ownership; it does not promise an immediate process RSS drop.
The recommended low-memory pattern is to call `memory.releaseFreed()` at loading screens or
map transitions, use eager mode during loading, then switch back to default during play:

```ts
import { memory } from '@gameengine/runtime';

const policy = await memory.setReleasePolicy('eager');
// After releasing the previous screen's assets, request a one-shot purge if appropriate.
const purge = await memory.releaseFreed();
// When entering allocation-heavy gameplay, select the standard Android interval explicitly.
await memory.setReleasePolicy('default');
```

No call preserves the OEM startup allocator behavior. `eager` requests decay time 0; explicit `default` requests 1 and cannot restore the unknown OEM startup value. Policy is process-wide, including games sharing a host. Policy requests require Android API 27; purge requires API 28 and has no trim fallback. Other platforms report unsupported. Each result states `supported`, `applied` and optional `reason` (`unsupported`, `refused`, `busy`); accepted does not mean a measured number of bytes was freed.

Calls are asynchronous and run on a bounded background worker, not the UI/render thread. They are for transitions, never a frame loop, and never from fixed-step systems. More aggressive release may cause later allocations to fault pages back in, and the saving is small (a few MiB in the engine's own measurements), so a game that opts into eager mode at startup on `phone-low` measures it first (frame rate and p95 frame time too: it can cost frame time): same-device interleaved runs, including returning to recently unloaded content, with RSS/PSS recorded separately from engine residency.
