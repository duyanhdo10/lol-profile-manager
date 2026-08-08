import { Badge, Button, Card, Grid, Group, Select, Stack, Text, Textarea, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { Division, Queue, Tier } from '../../shared/models';
import { useProfilePreview } from '../hooks/use-profile-preview';
import { useAppStore } from '../store/app-store';
import styles from './PresencePage.module.css';

const tiers: Tier[] = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
];
const divisions: Division[] = ['I', 'II', 'III', 'IV'];

export function PresencePage() {
  const { t } = useTranslation();
  const current = useAppStore((state) => state.current);
  const draft = useAppStore((state) => state.draft);
  const patchDraft = useAppStore((state) => state.patchDraft);
  const clearField = useAppStore((state) => state.clearField);
  const preview = useProfilePreview();
  const rank = preview.rank ?? {
    queue: 'RANKED_SOLO_5x5' as Queue,
    tier: 'EMERALD' as Tier,
    division: 'I' as Division,
  };
  const queues: Array<{ value: Queue; label: string }> = [
    { value: 'RANKED_SOLO_5x5', label: t('presence.solo') },
    { value: 'RANKED_FLEX_SR', label: t('presence.flex') },
    { value: 'RANKED_TFT', label: t('presence.tft') },
  ];
  const quickStatuses = [
    t('presence.quick1'),
    t('presence.quick2'),
    t('presence.quick3'),
    t('presence.quick4'),
  ];
  const updateRank = (patch: Partial<typeof rank>) => {
    const next = { ...rank, ...patch };
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(next.tier)) next.division = 'I';
    patchDraft({ rank: next });
  };

  return (
    <Stack gap="lg">
      <Card className={styles.preview}>
        <Group justify="space-between" align="center">
          <div>
            <Text className={styles.eyebrow}>{t('presence.preview')}</Text>
            <Title order={2}>{preview.status || t('presence.noStatus')}</Title>
            <Text c="dimmed" mt={4}>
              {preview.rank
                ? `${preview.rank.tier} ${preview.rank.division} · ${preview.rank.queue}`
                : t('presence.noRank')}
            </Text>
          </div>
          <div className={styles.emblem} data-tier={preview.rank?.tier ?? 'UNRANKED'}>
            <span>{preview.rank?.tier.slice(0, 1) ?? 'U'}</span>
            <strong>{preview.rank?.tier ?? t('presence.unranked')}</strong>
            <small>{preview.rank?.division ?? ''}</small>
          </div>
        </Group>
      </Card>
      <Grid>
        <Grid.Col span={6}>
          <Card className={styles.editor}>
            <Group justify="space-between">
              <div>
                <Text className={styles.eyebrow}>{t('presence.chat')}</Text>
                <Title order={3}>{t('presence.status')}</Title>
              </div>
              <Badge variant="light">{t('presence.friends')}</Badge>
            </Group>
            <Textarea
              mt="xl"
              minRows={5}
              maxLength={128}
              value={preview.status}
              onChange={(event) => patchDraft({ statusMessage: event.currentTarget.value })}
              placeholder={t('presence.placeholder')}
            />
            <Group justify="space-between" mt="xs">
              <Button
                variant="subtle"
                color="gray"
                disabled={draft.statusMessage === undefined}
                onClick={() => clearField('status')}
              >
                {t('presence.keepStatus')}
              </Button>
              <Text size="xs" c={preview.status.length >= 120 ? 'orange' : 'dimmed'}>
                {preview.status.length}/128
              </Text>
            </Group>
            <Group mt="lg" gap="xs">
              {quickStatuses.map((value) => (
                <Button
                  key={value}
                  size="compact-sm"
                  variant="light"
                  color="gray"
                  onClick={() => patchDraft({ statusMessage: value })}
                >
                  {value}
                </Button>
              ))}
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={6}>
          <Card className={styles.editor}>
            <Group justify="space-between">
              <div>
                <Text className={styles.eyebrow}>{t('presence.chat')}</Text>
                <Title order={3}>{t('presence.rank')}</Title>
              </div>
              <Badge variant="light">{t('presence.hovercard')}</Badge>
            </Group>
            <Stack mt="xl">
              <Select
                label={t('presence.queue')}
                value={rank.queue}
                data={queues}
                onChange={(value) => updateRank({ queue: (value ?? 'RANKED_SOLO_5x5') as Queue })}
              />
              <Group grow align="flex-start">
                <Select
                  label={t('presence.tier')}
                  value={rank.tier}
                  data={tiers}
                  onChange={(value) => updateRank({ tier: (value ?? 'EMERALD') as Tier })}
                />
                <Select
                  label={t('presence.division')}
                  value={rank.division}
                  data={divisions}
                  disabled={['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(rank.tier)}
                  onChange={(value) => updateRank({ division: (value ?? 'I') as Division })}
                />
              </Group>
              <Group justify="space-between">
                <Button
                  variant="subtle"
                  color="gray"
                  disabled={draft.rank === undefined}
                  onClick={() => clearField('rank')}
                >
                  {t('presence.keepRank')}
                </Button>
                <Text size="xs" c="dimmed">
                  {t('presence.visualOnly')}
                </Text>
              </Group>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
      <Text size="xs" c="dimmed">
        {t('presence.currentStatus', { status: current.statusMessage || t('presence.empty') })}
      </Text>
    </Stack>
  );
}
