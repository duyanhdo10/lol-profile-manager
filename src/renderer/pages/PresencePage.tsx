import { Badge, Button, Card, Group, Select, SimpleGrid, Stack, Text, Textarea, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_RANK_QUEUES,
  type Division,
  type Queue,
  type RankDisplayDraft,
  type Tier,
} from '../../shared/models';
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
const queueOrder: Queue[] = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR', 'RANKED_TFT'];

export function PresencePage() {
  const { t } = useTranslation();
  const current = useAppStore((state) => state.current);
  const catalog = useAppStore((state) => state.catalog);
  const draft = useAppStore((state) => state.draft);
  const patchDraft = useAppStore((state) => state.patchDraft);
  const clearField = useAppStore((state) => state.clearField);
  const preview = useProfilePreview();
  const queueLabels: Record<Queue, string> = {
    RANKED_SOLO_5x5: t('presence.solo'),
    RANKED_FLEX_SR: t('presence.flex'),
    RANKED_TFT: t('presence.tft'),
  };
  const quickStatuses = [
    t('presence.quick1'),
    t('presence.quick2'),
    t('presence.quick3'),
    t('presence.quick4'),
  ];

  const initialRankDraft = (): RankDisplayDraft => ({
    activeQueue: current.rank?.queue ?? 'RANKED_SOLO_5x5',
    queues: {
      RANKED_SOLO_5x5: current.rankedQueues.RANKED_SOLO_5x5 ?? DEFAULT_RANK_QUEUES.RANKED_SOLO_5x5,
      RANKED_FLEX_SR: current.rankedQueues.RANKED_FLEX_SR ?? DEFAULT_RANK_QUEUES.RANKED_FLEX_SR,
      RANKED_TFT: current.rankedQueues.RANKED_TFT ?? DEFAULT_RANK_QUEUES.RANKED_TFT,
    },
  });
  const rankDraft = draft.rank ?? initialRankDraft();
  const updateQueue = (queue: Queue, patch: Partial<(typeof rankDraft.queues)[Queue]>) => {
    const next = { ...rankDraft.queues[queue], ...patch, queue };
    if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(next.tier)) next.division = 'I';
    patchDraft({
      rank: {
        ...rankDraft,
        queues: { ...rankDraft.queues, [queue]: next },
      },
    });
  };
  const activateQueue = (queue: Queue) => patchDraft({ rank: { ...rankDraft, activeQueue: queue } });

  return (
    <Stack gap="lg">
      <Card className={styles.preview}>
        <Group justify="space-between" align="center">
          <div>
            <Text className={styles.eyebrow}>{t('presence.preview')}</Text>
            <Title order={2}>{preview.status || t('presence.noStatus')}</Title>
            <Text c="dimmed" mt={4}>
              {preview.rank
                ? `${preview.rank.tier} ${preview.rank.division} · ${queueLabels[preview.rank.queue]}`
                : t('presence.noRank')}
            </Text>
          </div>
          <div className={styles.emblem} data-tier={preview.rank?.tier ?? 'UNRANKED'}>
            <div className={styles.previewRankArtwork}>
              {preview.rank && (
                <img
                  src={catalog?.rankEmblems.find((item) => item.tier === preview.rank?.tier)?.imageUrl}
                  alt=""
                />
              )}
            </div>
            <strong>{preview.rank?.tier ?? t('presence.unranked')}</strong>
            <small>{preview.rank?.division ?? ''}</small>
          </div>
        </Group>
      </Card>

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
          minRows={3}
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

      <Group justify="space-between">
        <div>
          <Text className={styles.eyebrow}>{t('presence.chat')}</Text>
          <Title order={3}>{t('presence.rank')}</Title>
        </div>
        <Badge variant="light">{t('presence.hovercard')}</Badge>
      </Group>
      <SimpleGrid cols={{ base: 1, md: 3 }}>
        {queueOrder.map((queue) => {
          const actual = current.rankedQueues[queue];
          const appearance = rankDraft.queues[queue];
          const active = rankDraft.activeQueue === queue;
          const emblem = catalog?.rankEmblems.find((item) => item.tier === appearance.tier);
          return (
            <Card key={queue} className={styles.rankCard} data-active={active || undefined}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={4}>{queueLabels[queue]}</Title>
                  <Text size="xs" c="dimmed">
                    {actual
                      ? `${actual.tier} ${actual.division}${actual.leaguePoints === undefined ? '' : ` · ${actual.leaguePoints} LP`}`
                      : t('presence.unranked')}
                  </Text>
                </div>
                <Badge color={active ? 'teal' : 'gray'} variant="light">
                  {active ? t('presence.active') : t('presence.saved')}
                </Badge>
              </Group>
              <div className={styles.rankArtwork}>
                {emblem?.imageUrl ? <img src={emblem.imageUrl} alt="" /> : <span>{appearance.tier[0]}</span>}
              </div>
              <Group grow align="flex-start">
                <Select
                  label={t('presence.tier')}
                  value={appearance.tier}
                  data={tiers}
                  onChange={(value) => updateQueue(queue, { tier: (value ?? 'IRON') as Tier })}
                />
                <Select
                  label={t('presence.division')}
                  value={appearance.division}
                  data={divisions}
                  disabled={['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(appearance.tier)}
                  onChange={(value) => updateQueue(queue, { division: (value ?? 'IV') as Division })}
                />
              </Group>
              <Button
                fullWidth
                mt="md"
                variant={active ? 'filled' : 'light'}
                onClick={() => activateQueue(queue)}
              >
                {t('presence.showOnHovercard')}
              </Button>
            </Card>
          );
        })}
      </SimpleGrid>
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
      <Text size="xs" c="dimmed">
        {t('presence.currentStatus', { status: current.statusMessage || t('presence.empty') })}
      </Text>
    </Stack>
  );
}
