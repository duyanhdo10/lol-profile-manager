import type { ApplyPreview, ApplyProfileResult } from './apply';
import type { CatalogRequest, CatalogSnapshot, InventorySnapshot } from './catalog';
import type { ProfileDraft, ProfileState } from './profile';
import type { ClientLocale, ConnectionState } from './session';

export interface IpcErrorPayload {
  code: string;
  params?: Record<string, string | number>;
  technicalMessage?: string;
}

export interface DiagnosticEvent {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  details?: Record<string, unknown>;
}

export interface DiagnosticsSnapshot {
  appVersion: string;
  userDataPath: string;
  logPath: string;
  recentEvents: DiagnosticEvent[];
}

export interface LcuBridge {
  getConnectionState(): Promise<ConnectionState>;
  getClientLocale(): Promise<ClientLocale | null>;
  onConnectionState(listener: (state: ConnectionState) => void): () => void;
  onProfileMayHaveReset(listener: () => void): () => void;
  readProfile(): Promise<ProfileState>;
  readInventory(): Promise<InventorySnapshot>;
  getCatalog(request: CatalogRequest): Promise<CatalogSnapshot>;
  previewApply(draft: ProfileDraft): Promise<ApplyPreview>;
  applyDraft(draft: ProfileDraft): Promise<ApplyProfileResult>;
}
