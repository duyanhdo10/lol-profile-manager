import {
  app,
  BrowserWindow,
  globalShortcut,
  net,
  protocol,
  session,
  type IpcMainInvokeEvent,
} from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { autoUpdater } from 'electron-updater';
import type { CatalogSnapshot } from '../src/shared/models';
import { AppLogger } from './app-logger';
import { CatalogService } from './catalog-service';
import { migrateLegacyCompatibility } from './compatibility-migration';
import { CompatibilityStore } from './compatibility-store';
import { registerApplicationIpc } from './ipc-registration';
import { LcuClient } from './lcu-client';
import { UpdateService } from './update-service';

const serve = process.argv.includes('--serve');
const rendererUrl = serve
  ? 'http://127.0.0.1:5173/'
  : pathToFileURL(path.join(__dirname, '..', '..', 'dist', 'renderer', 'index.html')).toString();
let mainWindow: BrowserWindow | null = null;
let appLogger: AppLogger | null = null;
let updateCheckTimer: NodeJS.Timeout | null = null;
const IMAGE_HOSTS = new Set(['raw.communitydragon.org']);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'lpm-image',
    privileges: { standard: true, secure: true, supportFetchAPI: false, corsEnabled: false },
  },
]);

if (process.env['LPM_DISABLE_GPU'] === '1') app.disableHardwareAcceleration();
if (process.env['LPM_USER_DATA']) app.setPath('userData', path.resolve(process.env['LPM_USER_DATA']));

function sameRendererDocument(source: string): boolean {
  try {
    const actual = new URL(source);
    const expected = new URL(rendererUrl);
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname
    );
  } catch {
    return false;
  }
}

function trustedSender(event: IpcMainInvokeEvent): void {
  const source = event.senderFrame?.url;
  if (!source || !sameRendererDocument(source)) throw new Error('IPC request rejected: untrusted sender.');
  if (event.sender !== mainWindow?.webContents) throw new Error('IPC request rejected: unknown window.');
}

function applyCsp(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; img-src 'self' lpm-image: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
        ],
      },
    });
  });
}

function createWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1080,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#061019',
    icon: path.join(__dirname, '..', '..', 'src', 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: serve,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, target) => {
    if (!sameRendererDocument(target)) event.preventDefault();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    void appLogger?.warn('renderer.gone', { reason: details.reason, exitCode: details.exitCode });
  });
  void mainWindow.loadURL(rendererUrl);
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  return mainWindow;
}

async function initialize(): Promise<void> {
  applyCsp();
  protocol.handle('lpm-image', async (request) => {
    try {
      const encoded = new URL(request.url).pathname.slice(1);
      const target = new URL(Buffer.from(encoded, 'base64url').toString('utf8'));
      if (target.protocol !== 'https:' || !IMAGE_HOSTS.has(target.hostname))
        return new Response('Forbidden', { status: 403 });
      return await net.fetch(target.toString(), { bypassCustomProtocolHandlers: true });
    } catch {
      return new Response('Bad image URL', { status: 400 });
    }
  });

  const userData = app.getPath('userData');
  appLogger = new AppLogger(userData, app.getVersion());
  await appLogger.initialize();
  const migration = await migrateLegacyCompatibility(app.getPath('appData'), userData);
  if (migration.migrated)
    void appLogger.info('compatibility.migrated', { imported: migration.imported, source: migration.source });

  const lcu = new LcuClient(app.getAppPath());
  const catalog = new CatalogService(userData);
  const compatibility = new CompatibilityStore(userData);
  const updates = new UpdateService(autoUpdater, {
    enabled: app.isPackaged && process.env['LPM_DISABLE_UPDATER'] !== '1',
    logger: appLogger,
  });
  updates.onState((state) => mainWindow?.webContents.send('update:state', state));
  updates.start();
  registerApplicationIpc({
    trustedSender,
    getLogger: () => appLogger,
    lcu,
    catalog,
    compatibility,
    updates,
    proxyCatalogImages,
  });

  lcu.on('state', (state) => {
    void appLogger?.info('lcu.state', { state, clientVersion: lcu.getClientVersion() });
    mainWindow?.webContents.send('connection:state', state);
  });
  lcu.on('reconnected', () => mainWindow?.webContents.send('profile:may-have-reset'));
  lcu.start();
  createWindow();
  if (updates.getState().status !== 'disabled') {
    updateCheckTimer = setTimeout(() => void updates.checkForUpdates(), 5_000);
  }
}

function proxyCatalogImages(snapshot: CatalogSnapshot): CatalogSnapshot {
  const proxy = (imageUrl: string): string => {
    if (!imageUrl.startsWith('https://')) return imageUrl;
    return `lpm-image://asset/${Buffer.from(imageUrl, 'utf8').toString('base64url')}`;
  };
  return {
    ...snapshot,
    icons: snapshot.icons.map((item) => ({ ...item, imageUrl: proxy(item.imageUrl) })),
    backgrounds: snapshot.backgrounds.map((item) => ({ ...item, imageUrl: proxy(item.imageUrl) })),
    titles: snapshot.titles.map((item) => ({ ...item, imageUrl: proxy(item.imageUrl) })),
    tokens: snapshot.tokens.map((item) => ({ ...item, imageUrl: proxy(item.imageUrl) })),
    regalia: snapshot.regalia.map((item) => ({ ...item, imageUrl: proxy(item.imageUrl) })),
    rankEmblems: snapshot.rankEmblems.map((item) => ({ ...item, imageUrl: proxy(item.imageUrl) })),
  };
}

const hasLock = app.requestSingleInstanceLock();
if (!hasLock) app.quit();
else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app
    .whenReady()
    .then(() => {
      globalShortcut.register('CommandOrControl+R', () => undefined);
      return initialize();
    })
    .catch((error: unknown) => {
      console.error(error);
      app.quit();
    });
}

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => {
  if (updateCheckTimer) clearTimeout(updateCheckTimer);
  globalShortcut.unregisterAll();
});
