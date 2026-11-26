// Live tweaks of the sheet's General parameters, applied over src/balance.sheet.ts (src/balance.ts).
// The values live in src/balance.tweaks.json, written by the editor's Tune + Play mode
// (editor/widgets/general-params.tsx; the editor's bus writes JSON, not TypeScript), and hot reload.
// Temporary by design: copy the values you keep into the Google Sheet, sync, then Reset all.
// The game/balance-tweaks check warns while the JSON holds any value.
import type { BalanceSheet } from './balance.sheet.ts';
import data from './balance.tweaks.json';

export const TWEAKS = data as Partial<BalanceSheet['general']>;
