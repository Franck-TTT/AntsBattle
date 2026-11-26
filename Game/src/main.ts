/**
 * Ant Battle: a live maze tower defense. Ants march from the nest to the base; the player drags
 * walls, towers and cannons onto the board (each level's size, 7×11 by default) and the column reroutes instantly.
 *
 * Sim (deterministic, fixed step): src/sim/*. Presentation (LateUpdate, UI): src/present/*, src/ui/*.
 */
export { BuildBoard, StartRun, PlaceMarkers, FitView, NestSync, BaseLives } from './sim/board.ts';
export { DragItems, GameSpeed } from './sim/placement.ts';
export { Waves, SyncFlow, MoveEnemies, Combat } from './sim/battle.ts';
export { TraySync } from './sim/tray.ts';
export { PickLevel, OpenMenu } from './sim/menu.ts';
export { PayRun, RollUpgrade } from './sim/progress.ts';
export { Overlay, shapesPool, ringsPool } from './present/overlay.ts';
export { Juice } from './present/juice.ts';
export { Infection, trailsPool } from './present/infection.ts';
export { GameUI } from './ui/game.ui.tsx';
export { HudView } from './views/hud.view.tsx';
export { BannerView } from './views/banner.view.tsx';
export { EndView } from './views/end.view.tsx';
export { LevelMenuView } from './views/level-menu.view.tsx';
export { UpgradesView, UpgradeRevealView } from './views/upgrades.view.tsx';
