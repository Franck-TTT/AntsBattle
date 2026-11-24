# AntsBattle — project notes

This file is yours. `gameengine skills update` writes it once, when it is missing, and never
touches it again, so this is where everything specific to AntsBattle goes. `AGENTS.md`, `CLAUDE.md`
and the skills belong to the engine and are replaced when it updates them; put nothing project-specific there.

Agents read this file before `AGENTS.md`. Where the two disagree, this file wins for this project.
Agents do not write here on their own; they change this file only when someone asks them to add
specific guidance.

## The game

What it is, who it is for, and the core loop in a sentence or two.

## Conventions

Naming, folder layout, team rules and anything an agent should do differently here.

### Balancing values come from a Google Sheet

The game's tunable numbers (general parameters, weapons, units, waves, offers) live in the Google
Sheet **"Ants battle balancing"**:
https://docs.google.com/spreadsheets/d/1MwWoXQ96KbL_xSVf_P2YX7napk90BDMLbGvXpz9_k0s/edit

- The sheet is the source of truth. `src/balance.sheet.ts` is generated from it and `src/balance.ts`
  reads it. Never edit `src/balance.sheet.ts` by hand: the `game/balance-sheet` check fails on hand
  edits. To change a value, change the sheet, then sync.
- The sheet stays private (security decision): never share it by link or ask to. Sync it this way:
  fetch each tab with the Google Sheets MCP (`get_values`, range `<Tab>!A1:Z1000`), save each
  response as `.gameengine/sheet-snapshot/<Tab name>.json` (`{"values": [[...]]}`, git-ignored),
  then run `gameengine tool sheet-sync --dir .gameengine/sheet-snapshot`. It rewrites
  `src/balance.sheet.ts` and lists the values that changed (`--preview` writes nothing). Without
  `--dir` the tool tries a direct download, which fails on a private sheet.
- Tabs read: `General parameters`, `Weapons`, `Units`, `Waves`, `Offers`. `_Enums` holds the
  dropdown lists as named ranges (`WeaponsType`, `UnitsType`, `ItemType`, `BlockShape`): every enum
  used in several places goes there, never typed by hand.
- Sheet format: rows starting with `@` or ending with `>` are titles for people; text in
  parentheses in a label is a unit or hint and is ignored. Weapons and Units have one column per
  entry with its id in row 1; Waves and Offers have one row per entry. The sheet's locale is
  French (`0,32`). Ids in `_Enums` are the code's enum values (`tower`, `ant`); the `Name` row is
  the display name.
- A new parameter or stat: add the row to the sheet, map its label in `tools/balance-sheet.ts`
  (`GENERAL`, `WEAPON`, `UNIT`), then use it from `src/balance.ts`. A new weapon, unit or block
  shape goes in `schema/game.schema.ts` first (`gameengine gen`), then in the sheet's `_Enums`.
- Writing to the sheet (new rows, tabs, formatting) is fine when asked; follow the existing
  format, colours and dropdowns.

## Decisions

Choices already made, and why, so agents do not reopen them.

## Links

Design docs, tickets, dashboards, the people to ask.

- Balancing sheet: https://docs.google.com/spreadsheets/d/1MwWoXQ96KbL_xSVf_P2YX7napk90BDMLbGvXpz9_k0s/edit (see Conventions).
