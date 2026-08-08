import { Button, Group, Paper, Text } from '@mantine/core';
import { IconArrowRight, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/app-store';
import styles from './ApplyBar.module.css';

export function ApplyBar() {
  const { t } = useTranslation();
  const draft = useAppStore((state) => state.draft);
  const connection = useAppStore((state) => state.connection);
  const catalog = useAppStore((state) => state.catalog);
  const busy = useAppStore((state) => state.busy);
  const clearDraft = useAppStore((state) => state.clearDraft);
  const prepareApply = useAppStore((state) => state.prepareApply);
  const count = Object.keys(draft).length;

  return (
    <Paper className={styles.bar} radius={0}>
      <div>
        <Text fw={750} size="sm">
          {count ? t('applyBar.ready', { count }) : t('applyBar.empty')}
        </Text>
        <Text size="xs" c="dimmed">
          {t('applyBar.order')}
        </Text>
      </div>
      <Group>
        {count > 0 && (
          <Button variant="subtle" color="gray" leftSection={<IconTrash size={15} />} onClick={clearDraft}>
            {t('applyBar.clear')}
          </Button>
        )}
        <Button
          rightSection={<IconArrowRight size={16} />}
          onClick={() => void prepareApply()}
          loading={busy}
          disabled={!count || connection !== 'connected' || catalog?.compatible === false}
        >
          {catalog?.compatible === false ? t('applyBar.matching') : t('applyBar.review')}
        </Button>
      </Group>
    </Paper>
  );
}
