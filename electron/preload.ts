import { contextBridge, ipcRenderer } from 'electron';
import type { ConnectionState, IpcErrorPayload, LcuBridge } from '../src/shared/models';

const ERROR_MARKER = 'LPM_IPC_ERROR:';

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as T;
  } catch (error: unknown) {
    const technicalMessage = error instanceof Error ? error.message : String(error);
    const markerIndex = technicalMessage.indexOf(ERROR_MARKER);
    if (markerIndex >= 0) {
      try {
        throw JSON.parse(technicalMessage.slice(markerIndex + ERROR_MARKER.length)) as IpcErrorPayload;
      } catch (parsed: unknown) {
        if (typeof parsed === 'object' && parsed !== null && 'code' in parsed) throw parsed;
      }
    }
    throw {
      code: 'REQUEST_FAILED',
      technicalMessage,
    } satisfies IpcErrorPayload;
  }
}

const bridge: LcuBridge = {
  getConnectionState: () => invoke('connection:get'),
  getClientLocale: () => invoke('locale:get-client'),
  onConnectionState: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: ConnectionState) => listener(state);
    ipcRenderer.on('connection:state', wrapped);
    return () => ipcRenderer.removeListener('connection:state', wrapped);
  },
  onProfileMayHaveReset: (listener) => {
    const wrapped = () => listener();
    ipcRenderer.on('profile:may-have-reset', wrapped);
    return () => ipcRenderer.removeListener('profile:may-have-reset', wrapped);
  },
  readProfile: () => invoke('profile:read'),
  readInventory: () => invoke('inventory:read'),
  getCatalog: (request) => invoke('catalog:get', request),
  previewApply: (draft) => invoke('profile:preview-apply', draft),
  applyDraft: (draft) => invoke('profile:apply', draft),
};

contextBridge.exposeInMainWorld('lpm', Object.freeze(bridge));
