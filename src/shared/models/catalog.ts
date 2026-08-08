import type { AppLocale } from './session';
import type { ProfileField, Tier } from './profile';

export type Ownership = 'owned' | 'unowned' | 'unknown';
export type Compatibility = 'compatible' | 'not-compatible' | 'unknown';
export type Visibility = 'Self profile' | 'Friends/hovercard' | 'Profile/hovercard' | 'Transient';
export type CatalogKind = 'icon' | 'background';
export type ChallengeTier = Tier;
export type CatalogLoadMode = 'cache-first' | 'force-refresh';

export interface CatalogRequest {
  locale: AppLocale;
  mode: CatalogLoadMode;
}

interface CatalogMetadata {
  name: string;
  description?: string;
  imageUrl: string;
  source: 'CommunityDragon';
  sourceVersion: string;
  ownership: Ownership;
  compatibility: Compatibility;
  visibility: Visibility[];
}

export interface CatalogItem extends CatalogMetadata {
  id: number;
  kind: CatalogKind;
  champion?: string;
  skinline?: string;
  rarity?: string;
  year?: number;
  legacy: boolean;
}

export interface ChallengeTitleCatalogItem extends CatalogMetadata {
  contentId: string;
  itemId: number;
  acquisitionType?: string;
  category?: string;
  tier?: ChallengeTier;
}

export interface ChallengeTokenCatalogItem extends CatalogMetadata {
  id: number;
  category?: string;
  tier?: ChallengeTier;
}

export interface RegaliaCatalogItem extends CatalogMetadata {
  id: string;
  contentId: string;
  regaliaType: 'kBanner';
}

export interface CatalogFallback {
  file: string;
  requestedLocale: AppLocale;
  actualLocale: AppLocale;
}

export interface CatalogSnapshot {
  schemaVersion?: number;
  version: string;
  patch: string;
  fetchedAt: string;
  fromCache: boolean;
  stale: boolean;
  compatible: boolean;
  locale: AppLocale;
  requestedLocale: AppLocale;
  fallbacks: CatalogFallback[];
  refreshFailed?: boolean;
  icons: CatalogItem[];
  backgrounds: CatalogItem[];
  titles: ChallengeTitleCatalogItem[];
  tokens: ChallengeTokenCatalogItem[];
  regalia: RegaliaCatalogItem[];
}

export interface InventorySnapshot {
  iconIds: number[] | null;
  skinIds: number[] | null;
  titleContentIds: string[] | null;
  challengeIds: number[] | null;
  regaliaContentIds: string[] | null;
}

export interface CompatibilityRecord {
  clientVersion: string;
  field: ProfileField;
  itemId: string | number;
  compatible: boolean;
  checkedAt: string;
}
