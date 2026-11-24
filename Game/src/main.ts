/**
 * Ant Battle: a live maze tower defense. Ants march from the nest to the base; the player drags
 * walls, towers and cannons onto the 7×11 board and the column reroutes instantly.
 *
 * Sim (deterministic, fixed step): src/sim/*. Presentation (LateUpdate, UI): src/present/*, src/ui/*.
 */
export { BuildBoard, StartRun, FitView, NestSync } from './sim/board.ts';
export { DragItems, GameSpeed } from './sim/placement.ts';
export { Waves, SyncFlow, MoveEnemies, Combat } from './sim/battle.ts';
export { TraySync } from './sim/tray.ts';
export { Overlay, shapesPool, ringsPool } from './present/overlay.ts';
export { Juice } from './present/juice.ts';
export { GameUI } from './ui/game.ui.tsx';
export { HudView } from './views/hud.view.tsx';
export { BannerView } from './views/banner.view.tsx';
export { EndView } from './views/end.view.tsx';
