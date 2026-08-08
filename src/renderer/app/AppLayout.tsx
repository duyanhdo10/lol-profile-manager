import {
  ActionIcon,
  Alert,
  AppShell,
  Box,
  Group,
  Loader,
  NavLink as MantineNavLink,
  Stack,
  Text,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconBrush,
  IconHome,
  IconPhoto,
  IconRefresh,
  IconShieldCheck,
  IconSparkles,
  IconUserCircle,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useLocation } from 'react-router';
import logoUrl from '../../assets/logo.png';
import { ApplyBar } from '../components/ApplyBar';
import { ReviewModal } from '../components/ReviewModal';
import { LanguageMenu } from '../features/settings/LanguageMenu';
import { useBridgeLifecycle } from '../hooks/use-bridge-lifecycle';
import { useAppStore } from '../store/app-store';
import styles from './AppLayout.module.css';

const navigation = [
  { to: '/overview', label: 'overview', icon: IconHome },
  { to: '/icons', label: 'icons', icon: IconUserCircle },
  { to: '/backgrounds', label: 'backgrounds', icon: IconPhoto },
  { to: '/showcase/title', label: 'showcase', icon: IconSparkles },
  { to: '/presence', label: 'presence', icon: IconBrush },
] as const;

const pageKeys = new Set(['overview', 'icons', 'backgrounds', 'showcase', 'presence']);

export function AppLayout() {
  useBridgeLifecycle();
  const { t } = useTranslation();
  const location = useLocation();
  const routeSection = location.pathname.split('/')[1] || 'overview';
  const section = pageKeys.has(routeSection) ? routeSection : 'overview';
  const connection = useAppStore((state) => state.connection);
  const catalog = useAppStore((state) => state.catalog);
  const catalogBusy = useAppStore((state) => state.catalogBusy);
  const refreshCatalog = useAppStore((state) => state.refreshCatalog);
  const error = useAppStore((state) => state.error);
  const dismissError = useAppStore((state) => state.dismissError);
  const resetBanner = useAppStore((state) => state.resetBanner);
  const setResetBanner = useAppStore((state) => state.setResetBanner);

  return (
    <AppShell
      navbar={{ width: 272, breakpoint: 'sm' }}
      header={{ height: 82 }}
      padding={0}
      className={styles.shell}
    >
      <AppShell.Navbar className={styles.navbar}>
        <Group gap="sm" className={styles.brand}>
          <div className={styles.brandMark} aria-hidden="true">
            <img src={logoUrl} alt="" />
          </div>
          <Box>
            <Text fw={800} size="sm">
              LoL Profile Manager
            </Text>
          </Box>
        </Group>
        <Stack gap={5} className={styles.navigation} component="nav" aria-label={t('nav.aria')}>
          {navigation.map((item) => (
            <MantineNavLink
              key={item.to}
              component={NavLink}
              to={item.to}
              label={t(`nav.${item.label}`)}
              leftSection={<item.icon size={18} stroke={1.7} />}
              active={location.pathname.startsWith(item.to.replace('/title', ''))}
              className={styles.navItem}
            />
          ))}
        </Stack>
        <div className={styles.navFooter}>
          <div className={styles.connectionCard} data-state={connection}>
            <span className={styles.connectionDot} />
            <div>
              <Text size="xs" fw={700}>
                {t(`connection.${connection}`, connection)}
              </Text>
              <Text size="xs" c="dimmed">
                {t('nav.leagueClient')}
              </Text>
            </div>
          </div>
          <Text size="xs" c="dimmed" lh={1.45}>
            {t('nav.disclaimer')}
          </Text>
        </div>
      </AppShell.Navbar>

      <AppShell.Header className={styles.header}>
        <Box>
          <Text className={styles.eyebrow}>{t(`page.${section}.eyebrow`)}</Text>
          <Title order={2}>{t(`page.${section}.title`)}</Title>
        </Box>
        <Group gap="xs">
          <LanguageMenu />
          <Tooltip label={t('common.refresh')}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={() => void refreshCatalog(true)}
              disabled={catalogBusy}
              aria-label={t('common.refresh')}
            >
              {catalogBusy ? <Loader size={16} /> : <IconRefresh size={18} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </AppShell.Header>

      <AppShell.Main className={styles.main} data-testid="app-root">
        <div className={styles.content}>
          {connection !== 'connected' && (
            <Alert color="blue" variant="light" icon={<IconShieldCheck size={18} />} mb="md">
              {t('alert.offline')}
            </Alert>
          )}
          {resetBanner && (
            <Alert
              color="yellow"
              icon={<IconAlertTriangle size={18} />}
              withCloseButton
              onClose={() => setResetBanner(false)}
              mb="md"
            >
              {t('alert.reset')}
            </Alert>
          )}
          {catalog?.refreshFailed && (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="md">
              {t('alert.refreshFailed')}
            </Alert>
          )}
          {catalog?.stale && !catalog.refreshFailed && (
            <Alert color="yellow" icon={<IconAlertTriangle size={18} />} mb="md">
              {t('alert.stale')}
            </Alert>
          )}
          {catalog && !catalog.compatible && (
            <Alert color="orange" icon={<IconAlertTriangle size={18} />} mb="md">
              {t('alert.mismatch')}
            </Alert>
          )}
          {catalog && catalog.fallbacks.length > 0 && (
            <Alert color="blue" variant="light" mb="md">
              {t('alert.fallback', { count: catalog.fallbacks.length })}
            </Alert>
          )}
          {error && (
            <Alert color="red" title={t('alert.errorTitle')} withCloseButton onClose={dismissError} mb="md">
              {t(`errors.${error.code}`, t('errors.REQUEST_FAILED'))}
            </Alert>
          )}
          <Outlet />
        </div>
        <ApplyBar />
        <ReviewModal />
      </AppShell.Main>
    </AppShell>
  );
}
