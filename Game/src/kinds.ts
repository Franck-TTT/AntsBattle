/** Enum value names by index, from the generated schema (index 0 of ItemKind is "none"). */
import { EnemyKind, FxKind, ItemKind, type EnemyKindName, type FxKindName, type ItemKindName } from './schema.gen.ts';

export type { EnemyKindName, FxKindName, ItemKindName };
export const ITEM_NAMES = Object.freeze(Object.keys(ItemKind) as ItemKindName[]);
export const ENEMY_NAMES = Object.freeze(Object.keys(EnemyKind) as EnemyKindName[]);
export const FX_NAMES = Object.freeze(Object.keys(FxKind) as FxKindName[]);
import { BlockShape, UpgradeKind, type BlockShapeName, type RarityName, type UpgradeKindName } from './schema.gen.ts';
export type { BlockShapeName, RarityName, UpgradeKindName };
export const UPGRADE_NAMES = Object.freeze(Object.keys(UpgradeKind) as UpgradeKindName[]);
export const SHAPE_NAMES = Object.freeze(Object.keys(BlockShape) as BlockShapeName[]);
