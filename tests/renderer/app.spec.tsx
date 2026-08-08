// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogSnapshot, LcuBridge } from '../../src/shared/models';
import { EMPTY_PROFILE } from '../../src/shared/models';
import { AppRouter } from '../../src/renderer/app/AppRouter';
import { resetAppStoreCoordinatorsForTests, useAppStore } from '../../src/renderer/store/app-store';

const catalog: CatalogSnapshot = {
  schemaVersion: 5,
  version: '16.15.1+release',
  patch: '16.15',
  fetchedAt: new Date().toISOString(),
  fromCache: true,
  stale: false,
  compatible: true,
  locale: 'en_US',
  requestedLocale: 'en_US',
  fallbacks: [],
  icons: [
    {
      id: 7,
      kind: 'icon',
      name: 'Offline icon',
      imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==',
      source: 'CommunityDragon',
      sourceVersion: '16.15',
      legacy: false,
      ownership: 'unknown',
      compatibility: 'unknown',
      visibility: ['Transient'],
    },
  ],
  backgrounds: [],
  titles: [],
  tokens: [],
  regalia: [],
  rankEmblems: [],
};

function bridge(): LcuBridge {
  return {
    getConnectionState: vi.fn(async () => 'disconnected' as const),
    getClientLocale: vi.fn(async () => null),
    onConnectionState: vi.fn(() => () => undefined),
    onProfileMayHaveReset: vi.fn(() => () => undefined),
    getUpdateState: vi.fn(async () => ({ status: 'disabled' as const })),
    checkForUpdates: vi.fn(async () => ({ status: 'upToDate' as const })),
    installUpdate: vi.fn(async () => undefined),
    onUpdateState: vi.fn(() => () => undefined),
    readProfile: vi.fn(async () => structuredClone(EMPTY_PROFILE)),
    readInventory: vi.fn(async () => ({
      iconIds: null,
      skinIds: null,
      titleContentIds: null,
      challengeIds: null,
      regaliaContentIds: null,
    })),
    getCatalog: vi.fn(async () => catalog),
    previewApply: vi.fn(),
    applyDraft: vi.fn(),
  };
}

beforeEach(() => {
  cleanup();
  resetAppStoreCoordinatorsForTests();
  window.lpm = bridge();
  useAppStore.setState({
    initialized: false,
    connection: 'connecting',
    current: structuredClone(EMPTY_PROFILE),
    catalog: null,
    draft: {},
    preview: null,
    applyResult: null,
    busy: false,
    catalogBusy: false,
    error: null,
    resetBanner: false,
    update: { status: 'disabled' },
    updateBannerDismissed: false,
    updateInstallConfirmOpened: false,
    localeMode: 'auto',
    locale: 'en_US',
  });
});

describe('React application shell', () => {
  it('deduplicates profile and catalog loads across bootstrap and a connected event', async () => {
    const lpm = bridge();
    vi.mocked(lpm.getConnectionState).mockResolvedValue('connected');
    window.lpm = lpm;
    await Promise.all([
      useAppStore.getState().initialize(),
      useAppStore.getState().handleConnection('connected'),
    ]);
    expect(lpm.readProfile).toHaveBeenCalledTimes(1);
    expect(lpm.getCatalog).toHaveBeenCalledTimes(1);
  });

  it('keeps ID-based draft selections when the locale changes', async () => {
    const lpm = bridge();
    vi.mocked(lpm.getCatalog).mockImplementation(async (request) => ({
      ...catalog,
      locale: request.locale,
      requestedLocale: request.locale,
    }));
    window.lpm = lpm;
    useAppStore.setState({ draft: { iconId: 7 } });
    await useAppStore.getState().setLocaleMode('vi_VN');
    expect(useAppStore.getState().draft).toEqual({ iconId: 7 });
    expect(useAppStore.getState().locale).toBe('vi_VN');
  });

  it('routes to the icon catalog and keeps unknown items selectable offline', async () => {
    const user = userEvent.setup();
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/icons']}>
          <AppRouter />
        </MemoryRouter>
      </MantineProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Icon collection' })).toBeInTheDocument();
    const item = await screen.findByRole('button', { name: /Offline icon/ });
    expect(item).toHaveTextContent('unknown');
    await user.click(item);
    expect(useAppStore.getState().draft.iconId).toBe(7);
  });

  it('redirects unknown routes to overview', async () => {
    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/missing']}>
          <AppRouter />
        </MemoryRouter>
      </MantineProvider>,
    );
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Profile overview' })).toBeInTheDocument(),
    );
  });

  it('clears composite draft fields independently', () => {
    useAppStore.setState({ draft: { iconId: 7, challengeShowcase: { tokenIds: [1, 2, 3] } } });
    useAppStore.getState().clearField('challengeShowcase');
    expect(useAppStore.getState().draft).toEqual({ iconId: 7 });
  });

  it('asks for confirmation before restarting when a profile draft exists', async () => {
    const user = userEvent.setup();
    const lpm = bridge();
    window.lpm = lpm;

    render(
      <MantineProvider>
        <MemoryRouter initialEntries={['/overview']}>
          <AppRouter />
        </MemoryRouter>
      </MantineProvider>,
    );

    await screen.findByRole('heading', { name: 'Profile overview' });
    act(() => {
      useAppStore.setState({
        draft: { iconId: 7 },
        update: {
          status: 'downloaded',
          availableVersion: '0.1.0-beta.3',
          percent: 100,
        },
      });
    });

    const restartButtons = await screen.findAllByRole('button', { name: 'Restart and update' });
    await user.click(restartButtons[0]);
    expect(screen.getAllByRole('heading', { name: 'Restart to update?' })).not.toHaveLength(0);
    expect(lpm.installUpdate).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Restart and update' }));
    await waitFor(() => expect(lpm.installUpdate).toHaveBeenCalledTimes(1));
  });
});
