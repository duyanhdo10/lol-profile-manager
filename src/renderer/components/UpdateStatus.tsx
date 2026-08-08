import { Alert, Button, Group, Modal, Progress, Stack, Text } from '@mantine/core';
import { IconCheck, IconDownload, IconRefresh, IconRocket, IconWifiOff } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/app-store';
import styles from './UpdateStatus.module.css';

export function UpdateBanner() {
  const { t } = useTranslation();
  const update = useAppStore((state) => state.update);
  const dismissed = useAppStore((state) => state.updateBannerDismissed);
  const busy = useAppStore((state) => state.busy);
  const requestInstall = useAppStore((state) => state.requestInstallUpdate);
  const dismiss = useAppStore((state) => state.dismissUpdateBanner);

  if (update.status === 'downloading') {
    return (
      <Alert color="blue" icon={<IconDownload size={18} />} mb="md" title={t('update.downloadingTitle')}>
        <Stack gap="xs">
          <Text size="sm">
            {t('update.downloading', {
              version: update.availableVersion ?? t('update.newVersion'),
              percent: Math.round(update.percent ?? 0),
            })}
          </Text>
          <Progress value={update.percent ?? 0} animated aria-label={t('update.progress')} />
        </Stack>
      </Alert>
    );
  }

  if (update.status !== 'downloaded' || dismissed) return null;
  return (
    <Alert color="teal" icon={<IconRocket size={18} />} mb="md" title={t('update.readyTitle')}>
      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm">{t('update.ready', { version: update.availableVersion })}</Text>
        <Group gap="xs">
          <Button variant="subtle" color="gray" size="xs" onClick={dismiss}>
            {t('update.later')}
          </Button>
          <Button size="xs" onClick={() => void requestInstall()} disabled={busy}>
            {t('update.restart')}
          </Button>
        </Group>
      </Group>
    </Alert>
  );
}

export function UpdateControl() {
  const { t } = useTranslation();
  const update = useAppStore((state) => state.update);
  const busy = useAppStore((state) => state.busy);
  const check = useAppStore((state) => state.checkForUpdates);
  const install = useAppStore((state) => state.requestInstallUpdate);
  const checking = update.status === 'checking';
  const downloading = update.status === 'downloading';
  const downloaded = update.status === 'downloaded';
  const disabled = update.status === 'disabled';
  const Icon =
    update.status === 'error'
      ? IconWifiOff
      : downloaded
        ? IconRocket
        : update.status === 'upToDate'
          ? IconCheck
          : downloading
            ? IconDownload
            : IconRefresh;

  return (
    <div className={styles.control} data-status={update.status}>
      <Group gap="xs" wrap="nowrap">
        <Icon size={17} aria-hidden="true" />
        <div className={styles.controlCopy}>
          <Text size="xs" fw={700}>
            {t(`update.status.${update.status}`)}
          </Text>
          {update.availableVersion && (
            <Text size="xs" c="dimmed">
              v{update.availableVersion}
            </Text>
          )}
        </div>
      </Group>
      <Button
        variant="subtle"
        color={downloaded ? 'teal' : 'gray'}
        size="compact-xs"
        loading={checking}
        disabled={disabled || downloading || busy}
        onClick={() => void (downloaded ? install() : check())}
      >
        {downloaded ? t('update.restart') : t('update.check')}
      </Button>
      {downloading && <Progress value={update.percent ?? 0} size="xs" mt="xs" />}
    </div>
  );
}

export function UpdateRestartModal() {
  const { t } = useTranslation();
  const opened = useAppStore((state) => state.updateInstallConfirmOpened);
  const busy = useAppStore((state) => state.busy);
  const close = useAppStore((state) => state.closeInstallUpdateConfirm);
  const confirm = useAppStore((state) => state.confirmInstallUpdate);

  return (
    <Modal opened={opened} onClose={close} title={t('update.confirmTitle')} centered>
      <Stack>
        <Text size="sm">{t('update.confirmDraft')}</Text>
        <Text size="sm" c="dimmed">
          {t('update.confirmRestart')}
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={close}>
            {t('update.cancel')}
          </Button>
          <Button color="teal" onClick={() => void confirm()} disabled={busy}>
            {t('update.restart')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
