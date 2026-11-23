---
name: extension-points
version: 1.0.0
tier: optional
description: Extension points instead of reflection - gameengine.extensionPoints and contributes in package.json, src/extensions.gen.ts, kinds as values (defineXKind), _type_-tagged data and editor forms from one list. Use when porting Unity code that finds subclasses or [Attribute] classes, or when packages add kinds to a registry.
---

# Extension points: kinds without reflection

Unity code often finds its parts by reflection: every subclass of `TaskStepAction`, every class with an
`[ActionType]` attribute, `TypeCache.GetTypesDerivedFrom<T>()`, polymorphic JSON tagged with a type name. A new
package adds a kind just by being in the project. Game Engine has no reflection, and sim code must not depend on
what happens to be imported. Do the same with an **extension point**: a typed list one package declares, that other
packages and the game contribute values to, and that `gameengine gen` writes into `src/extensions.gen.ts`.

Never replace reflection with a hand-kept list in the game (it goes stale, and the editor gets a second one), with
`registerKind()` calls at module load (module state, import-order bugs) or with scanning source for a marker.

## The recipe

### 1. Make each kind a value

The package that owns the concept exports a `define*` helper and the type every kind satisfies. Keep that module
free of engine runtime imports, so game code, `schema/*.schema.ts` files and editor modes can all load it:

```ts
// src/kind.ts in the owning package (exported as "./kind")
export interface RewardKind<T extends string = string> {
  readonly type: string;                 // the stored tag (_type_), unique among installed kinds
  readonly title: string;                // editor metadata lives on the kind too
  readonly fields: Fields;               // one field list gives the decoder, the TS type, the schema and the form
  grant(ctx: SystemContext, part: unknown): void; // sim behaviour, method syntax so registries hold any kind
}
export type AnyRewardKind = RewardKind<string>;
export const defineRewardKind = <const K extends AnyRewardKind>(kind: K): K => kind;
```

One value per kind replaces the Unity class, its `[JsonSerializable]` keys, its handler and its editor
descriptor. Derive everything else from it rather than declaring it twice.

### 2. Declare the point in the owning package's package.json

```json
"exports": { ".": "./src/index.ts", "./kind": "./src/kind.ts", "./kinds/*": "./src/kinds/*" },
"gameengine": {
  "extensionPoints": {
    "rewards.kinds": { "type": "AnyRewardKind", "from": "./kind", "doc": "Rewards a task can grant." }
  },
  "contributes": { "rewards.kinds": ["./kinds/coins.ts#coins"] }
}
```

- The id is dotted camelCase, owner first; gen exports it as `rewardsKinds`.
- `type` must be exported by the `from` export subpath. Every contribution is checked against it by the typecheck.
- `scope: "editor"` for a point whose values are editor code (React cards, custom forms): they go to
  `editor/extensions.gen.ts`, which only editor code imports, so the game bundle never reaches them.

### 3. Contribute from other packages and the game

A package that adds kinds depends on the declaring package and lists them, each `<export subpath>#<export name>`:

```json
"dependencies": { "@studio/rewards": "^1.0.0" },
"gameengine": { "contributes": { "rewards.kinds": ["./chest.ts#chest"] } }
```

The game contributes in the `gameengine` field of its own `package.json`, with project paths:

```json
"gameengine": { "contributes": { "rewards.kinds": ["./src/rewards/boosters.ts#booster"] } }
```

A game may declare points of its own the same way (`"from": "./src/items/kind.ts"`); only the game contributes to them, since no package can depend on the game. A package may contribute to a point of an optional dependency: when the game has not installed it, the contribution is left out.

Only installed packages contribute for themselves; a folder the game maps by name with tsconfig `paths` is game
code to the engine. To make a package that lives in the game's repo (`packages/chests/`, waiting to be extracted)
contribute its own kinds, install it: `"@studio/chests": "file:packages/chests"` in the game's `dependencies`, then
`gameengine package install`. Its `package.json` is then a package's: `exports`, `gameengine.engine`, its own
`contributes`, and the declaring package in `peerDependencies`, so it uses the game's copy rather than resolving
one of its own. Extracting it later changes only the `file:` spec.

### 4. Read the generated list; take it as a parameter in the package

```ts
// src/main.ts (the game)
import { rewardsKinds } from './extensions.gen.ts';
export const { GrantRewards } = rewardSystems({ kinds: rewardsKinds });
```

The owning package never imports `extensions.gen.ts` (it lives in the game): its systems, schema helpers and
editor take the list as an argument. The game passes the same list to all three:

- **Sim:** `rewardSystems({ kinds })` builds a map by `type` once; dispatch is a lookup, never a scan per part.
  Refuse two kinds with one `type` when the map is built.
- **Data:** stored parts carry the kind's tag (`{ "_type_": "Chest", ... }`). The package's schema helper turns
  the kinds into a union (`rewardFields(rewardsKinds)` in `schema/*.schema.ts`), so `gameengine validate` reports
  a part of a kind nobody installed and a missing or mistyped field.
- **Editor:** the editor mode imports the same list and builds its add menu and forms from each kind's fields, so
  a kind cannot be playable but missing from the editor. A kind whose data no form can show gets a custom card,
  matched by `type`; the game supplies cards that need its own data (characters, art), packages contribute the rest
  to an editor-scope point.

### 5. Regenerate

`gameengine gen` writes the list; installing, updating or switching on a package runs it. After editing a
`contributes` or `extensionPoints` entry by hand, run `gameengine gen`. Gen writes the lists before it loads
`schema/*.schema.ts`, so a schema may import them, even on a fresh checkout (`gameengine gen`; `gen --check` writes
nothing). Gen fails naming the entry when a point is declared twice, the game contributes to one nobody declares, a contributor does not depend on the declarer, or an export subpath, file,
export or the point's type does not exist. `gameengine gen --package .` checks a package's own entries for its
author. `gameengine package list` shows each package's points and contributions.

## Unity to Game Engine

| Unity | Game Engine |
|---|---|
| `abstract class TaskStepAction` + subclasses | `defineXKind({...})` values of one exported type |
| `[ActionType]`, `TypeCache.GetTypesDerivedFrom<T>()` | `gameengine.contributes` + `src/extensions.gen.ts` |
| `[JsonSerializable("si")] int stageIndex` | a field `si: f.int({ as: 'stageIndex', default: 0 })` on the kind |
| polymorphic JSON `_type_` | the same tag, decoded with the kind from the list |
| `ITaskStepActionHandler` per type | a method on the kind, looked up by `type` |
| editor `IActionType` per class | editor metadata on the kind; a custom card only where a form cannot show it |

## Checks before handing back

- No game file lists kinds by hand; `src/extensions.gen.ts` is regenerated and committed.
- Kind modules import no engine runtime and hold no module state.
- Removing a contribution removes the kind from the game, the schema and the editor together (try it once).
- The sim path does a map lookup per part, built once, not a search of the list.
