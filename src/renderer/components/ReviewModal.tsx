import { Alert, Badge, Button, Group, Modal, Stack, Table, Text } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../store/app-store';

export function ReviewModal() {
  const { t } = useTranslation();
  const preview = useAppStore((state) => state.preview);
  const busy = useAppStore((state) => state.busy);
  const closePreview = useAppStore((state) => state.closePreview);
  const confirmApply = useAppStore((state) => state.confirmApply);
  if (!preview) return null;

  const noChange = t('review.noChange');
  const rows: Array<{ field: string; before: string | number; after: string | number; changed: boolean }> = [
    {
      field: t('review.background'),
      before: preview.before.backgroundSkinId ?? t('review.unknown'),
      after: preview.draft.backgroundSkinId ?? noChange,
      changed: preview.draft.backgroundSkinId !== undefined,
    },
    {
      field: t('review.icon'),
      before: preview.before.iconId ?? t('review.unknown'),
      after: preview.draft.iconId ?? noChange,
      changed: preview.draft.iconId !== undefined,
    },
    {
      field: t('review.showcase'),
      before: t('review.tokens', { count: preview.before.challengeShowcase.tokenIds?.length ?? 0 }),
      after: preview.draft.challengeShowcase
        ? t('review.tokens', { count: preview.draft.challengeShowcase.tokenIds?.length ?? 0 })
        : noChange,
      changed: preview.draft.challengeShowcase !== undefined,
    },
    {
      field: t('review.regalia'),
      before: preview.before.regalia.preferredCrestType,
      after: preview.draft.regalia?.preferredCrestType ?? noChange,
      changed: preview.draft.regalia !== undefined,
    },
    {
      field: t('review.status'),
      before: preview.before.statusMessage || t('review.empty'),
      after: preview.draft.statusMessage ?? noChange,
      changed: preview.draft.statusMessage !== undefined,
    },
    {
      field: t('review.rank'),
      before: preview.before.rank
        ? `${preview.before.rank.tier} ${preview.before.rank.division} · ${preview.before.rank.queue}`
        : t('review.none'),
      after: preview.draft.rank
        ? (() => {
            const rank = preview.draft.rank.queues[preview.draft.rank.activeQueue];
            return `${rank.tier} ${rank.division} · ${preview.draft.rank.activeQueue}`;
          })()
        : noChange,
      changed: preview.draft.rank !== undefined,
    },
  ];

  return (
    <Modal
      opened
      onClose={closePreview}
      title={t('review.title')}
      size="lg"
      centered
      overlayProps={{ backgroundOpacity: 0.72, blur: 8 }}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {t('review.intro')}
        </Text>
        <Table verticalSpacing="sm" horizontalSpacing="md" withRowBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('review.field')}</Table.Th>
              <Table.Th>{t('review.current')}</Table.Th>
              <Table.Th>{t('review.selected')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.field}>
                <Table.Td>
                  <Text fw={700}>{row.field}</Text>
                </Table.Td>
                <Table.Td>{row.before}</Table.Td>
                <Table.Td>
                  <Badge color={row.changed ? 'teal' : 'gray'} variant="light">
                    {row.after}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {preview.warnings.map((warning, index) => (
          <Alert
            key={`${warning.field}-${index}`}
            color={warning.level === 'warning' ? 'yellow' : 'blue'}
            icon={
              warning.level === 'warning' ? <IconAlertTriangle size={17} /> : <IconInfoCircle size={17} />
            }
          >
            {warning.code ? t(`warnings.${warning.code}`, warning.params) : warning.message}
          </Alert>
        ))}
        <Alert color="gray" icon={<IconCheck size={17} />}>
          {t('review.disclaimer')}
        </Alert>
        <Group justify="flex-end">
          <Button variant="subtle" color="gray" onClick={closePreview}>
            {t('review.cancel')}
          </Button>
          <Button onClick={() => void confirmApply()} loading={busy}>
            {t('review.confirm')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
