import { Badge, Button, Card, Grid, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconBrush, IconPhoto, IconSparkles, IconUserCircle } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { ProfileHero } from '../components/ProfileHero';
import { useProfilePreview } from '../hooks/use-profile-preview';
import { useAppStore } from '../store/app-store';
import styles from './OverviewPage.module.css';

export function OverviewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const current = useAppStore((state) => state.current);
  const catalog = useAppStore((state) => state.catalog);
  const draft = useAppStore((state) => state.draft);
  const result = useAppStore((state) => state.applyResult);
  const preview = useProfilePreview();
  const currentIcon = catalog?.icons.find((item) => item.id === current.iconId);
  const currentBackground = catalog?.backgrounds.find((item) => item.id === current.backgroundSkinId);
  const actions = [
    {
      title: t('overview.chooseIcon'),
      copy: t('overview.chooseIconCopy'),
      to: '/icons',
      icon: IconUserCircle,
    },
    {
      title: t('overview.setBackground'),
      copy: t('overview.setBackgroundCopy'),
      to: '/backgrounds',
      icon: IconPhoto,
    },
    {
      title: t('overview.buildShowcase'),
      copy: t('overview.buildShowcaseCopy'),
      to: '/showcase/title',
      icon: IconSparkles,
    },
    { title: t('overview.presence'), copy: t('overview.presenceCopy'), to: '/presence', icon: IconBrush },
  ];

  return (
    <Stack gap="lg">
      <Grid>
        <Grid.Col span={{ base: 12, xl: 6 }}>
          <ProfileHero
            eyebrow={t('overview.live')}
            title={t('overview.current')}
            iconUrl={currentIcon?.imageUrl}
            backgroundUrl={currentBackground?.imageUrl}
            status={current.statusMessage}
            rank={current.rank}
            badge={t('overview.liveBadge')}
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, xl: 6 }}>
          <ProfileHero
            eyebrow={t('overview.draft')}
            title={preview.title?.name ?? t('overview.after')}
            iconUrl={preview.icon?.imageUrl}
            backgroundUrl={preview.background?.imageUrl}
            status={preview.status}
            rank={preview.rank}
            badge={t('overview.pending', { count: Object.keys(draft).length })}
          />
        </Grid.Col>
      </Grid>
      <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }}>
        {actions.map((action) => (
          <Card
            key={action.to}
            className={styles.actionCard}
            onClick={() => navigate(action.to)}
            role="button"
            tabIndex={0}
          >
            <Group justify="space-between">
              <ThemeIcon variant="light" size="lg">
                <action.icon size={19} />
              </ThemeIcon>
              <Text c="dimmed">↗</Text>
            </Group>
            <Title order={4} mt="xl">
              {action.title}
            </Title>
            <Text size="sm" c="dimmed" mt="xs">
              {action.copy}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
      {result && (
        <Card withBorder>
          <Group justify="space-between" mb="md">
            <div>
              <Text size="xs" c="teal" fw={800}>
                {t('overview.last')}
              </Text>
              <Title order={3}>{t(result.succeeded ? 'overview.completed' : 'overview.stopped')}</Title>
            </div>
            <Badge color={result.succeeded ? 'teal' : 'red'}>
              {result.rollbackAttempted
                ? t(result.rollbackSucceeded ? 'overview.rollbackSucceeded' : 'overview.rollbackIncomplete')
                : t('overview.noRollback')}
            </Badge>
          </Group>
          <SimpleGrid cols={3}>
            {result.steps.map((step) => (
              <Button
                key={step.field}
                variant="light"
                color={step.succeeded ? 'teal' : step.attempted ? 'red' : 'gray'}
              >
                {t(`review.${step.field}`)}: {t(step.succeeded ? 'common.applied' : 'common.failed')}
              </Button>
            ))}
          </SimpleGrid>
        </Card>
      )}
    </Stack>
  );
}
