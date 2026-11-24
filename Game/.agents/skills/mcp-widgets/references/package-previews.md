# Package previews that run locally

A package tool can opt into a cached web build with `mcpWidget: true` and
`webPreview: { project: './preview/project', entry: './preview/client.ts', prebuilt: 'preview/prebuilt' }`. Paths resolve from the original tool file. Package CI uses `gameengine web-preview --project <template> --owner <build-project> --entry <browser-entry> --export <new-directory>` to export a full build plus a separate UI-only program. Ship the exported directory through the npm allowlist and verify its inclusion. `prebuilt` loads those files without an engine checkout or compiler. Missing or corrupt declared artifacts fail; they never trigger a source build. Omitting `prebuilt` explicitly retains source development, where the first open bundles only the browser entry. Mount ordinary browser controls and a local
viewer first. Request generated data only after geometry edits; never request screenshots for
camera movement. A package tool with `mcpAppData: true` returns up to 8 MiB through standard
result metadata. `engine.json(result)` reads it without model-context text truncation.

The browser entry exports `function mount(engine)`. Offer an optional action that calls
`await engine.webPreview(canvas)` on a separate canvas. It loads the shipped engine program when `prebuilt` is declared. Source-only previews build a cached player with the installed native packages and require an engine checkout, Rust and Emscripten. Its
`nativeCall(packageName, operation, arg)` invokes the same Rust operation locally. Coalesce
drafts with `engine.live`. Simulation stays paused; settled and hidden previews stop rendering.

Keep file reads and explicit hash-guarded Save in package tools. The local runtime has cooked
content in memory and never writes back to the project. One widget owns one runtime, with
64 KiB UTF-8 requests, 1 MiB responses, a 32-call queue and a 2048-pixel render limit per side.
Register package observers and listeners with `engine.onCleanup`; runtime teardown is automatic.

The optional runtime needs WebGPU, a secure context, and host policy allowing WebAssembly and
dynamic JavaScript execution. Standard MCP Apps does not guarantee these browser permissions.
Catch startup failure and retain the baseline viewer. Use no private CSP flags or host changes.
Tool visibility and read-only hints do not override host approval. Verify the actual host before
claiming support; a successful build has not proved browser rendering.
