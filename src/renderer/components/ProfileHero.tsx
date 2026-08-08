import { Avatar, Badge, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import logoUrl from '../../assets/icon.png';
import type {
  ProfileIdentity,
  RankedQueueSnapshotMap,
  RegaliaContext,
  RegaliaAppearance,
  RankEmblemCatalogItem,
  Queue,
} from '../../shared/models';
import { cssVariables } from '../styles/css-variables';
import styles from './ProfileHero.module.css';

interface PreviewToken {
  id: number;
  name: string;
  imageUrl: string;
}

interface ProfileHeroProps {
  eyebrow: string;
  identity: ProfileIdentity;
  challengeTitle?: string;
  iconUrl?: string;
  backgroundUrl?: string;
  bannerUrl?: string;
  status: string;
  tokens: PreviewToken[];
  rankedQueues: RankedQueueSnapshotMap;
  activeRankQueue: Queue | null;
  regalia: RegaliaAppearance;
  regaliaContext: RegaliaContext;
  rankEmblems: RankEmblemCatalogItem[];
  badge?: string;
}

const queues: Queue[] = ['RANKED_SOLO_5x5', 'RANKED_FLEX_SR', 'RANKED_TFT'];

export function ProfileHero({
  eyebrow,
  identity,
  challengeTitle,
  iconUrl,
  backgroundUrl,
  bannerUrl,
  status,
  tokens,
  rankedQueues,
  activeRankQueue,
  regalia,
  regaliaContext,
  rankEmblems,
  badge,
}: ProfileHeroProps) {
  const { t } = useTranslation();
  const queueNames: Record<Queue, string> = {
    RANKED_SOLO_5x5: t('presence.solo'),
    RANKED_FLEX_SR: t('presence.flex'),
    RANKED_TFT: t('presence.tft'),
  };
  return (
    <Paper
      className={styles.hero}
      style={cssVariables({
        '--hero-background': backgroundUrl ? `url("${backgroundUrl}")` : 'none',
      })}
    >
      <div className={styles.topBar}>
        <Text className={styles.eyebrow}>{eyebrow}</Text>
        {badge && (
          <Badge color="teal" variant="light">
            {badge}
          </Badge>
        )}
      </div>
      <div className={styles.identity}>
        <Avatar src={iconUrl} size={96} radius={20} className={styles.avatar}>
          {!iconUrl && <img className={styles.logoFallback} src={logoUrl} alt="" />}
        </Avatar>
        <Stack gap={3}>
          <Group gap="xs" align="baseline">
            <Title order={2}>{identity.gameName || t('overview.current')}</Title>
            {identity.tagLine && <Text c="dimmed">#{identity.tagLine}</Text>}
          </Group>
          <Text className={styles.level}>{t('overview.level', { level: identity.accountLevel })}</Text>
          <Text c="gray.3">{challengeTitle ?? t('showcase.noTitle')}</Text>
          <Text size="sm" c="dimmed">
            {status || t('profileHero.noStatus')}
          </Text>
        </Stack>
        <Group className={styles.tokens} gap="xs">
          {tokens.slice(0, 3).map((token) => (
            <img key={token.id} src={token.imageUrl} alt={token.name} title={token.name} />
          ))}
        </Group>
      </div>
      <div className={styles.bottom}>
        <div className={styles.rankStrip}>
          {queues.map((queue) => {
            const rank = rankedQueues[queue];
            const emblem = rankEmblems.find((item) => item.tier === rank?.tier);
            return (
              <div
                key={queue}
                className={styles.rankCard}
                data-active={activeRankQueue === queue || undefined}
              >
                <div className={styles.rankEmblemCrop}>
                  {emblem?.imageUrl ? <img src={emblem.imageUrl} alt="" /> : <span>—</span>}
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    {queueNames[queue]}
                  </Text>
                  <Text size="sm" fw={700}>
                    {rank ? `${rank.tier} ${rank.division}` : t('presence.unranked')}
                  </Text>
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.regalia}>
          {bannerUrl && <img className={styles.profileBanner} src={bannerUrl} alt="" />}
          <div>
            <Text size="xs" c="dimmed">
              {t('showcase.regalia')}
            </Text>
            <Text size="sm" fw={700}>
              {t(`showcase.${regaliaContext.resolvedCrest}`)} ·{' '}
              {t(`showcase.${regaliaContext.resolvedBanner}`)}
            </Text>
            <Text size="xs" c="dimmed">
              {t('showcase.prestigeCode', { code: regalia.selectedPrestigeCrest })}
            </Text>
          </div>
        </div>
      </div>
    </Paper>
  );
}
