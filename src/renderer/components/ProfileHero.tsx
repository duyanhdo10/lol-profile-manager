import { Avatar, Badge, Box, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import logoUrl from '../../assets/logo.png';
import type { RankAppearance } from '../../shared/models';
import { cssVariables } from '../styles/css-variables';
import styles from './ProfileHero.module.css';

interface ProfileHeroProps {
  eyebrow: string;
  title: string;
  iconUrl?: string;
  backgroundUrl?: string;
  status: string;
  rank: RankAppearance | null;
  badge?: string;
}

export function ProfileHero({
  eyebrow,
  title,
  iconUrl,
  backgroundUrl,
  status,
  rank,
  badge,
}: ProfileHeroProps) {
  const { t } = useTranslation();
  return (
    <Paper
      className={styles.hero}
      style={cssVariables({ '--hero-background': backgroundUrl ? `url("${backgroundUrl}")` : 'none' })}
    >
      <Stack justify="space-between" h="100%">
        <Group justify="space-between">
          <Text className={styles.eyebrow}>{eyebrow}</Text>
          {badge && (
            <Badge color="teal" variant="light">
              {badge}
            </Badge>
          )}
        </Group>
        <Group align="flex-end" gap="lg">
          <Avatar src={iconUrl} size={80} radius={18} className={styles.avatar}>
            {!iconUrl && <img className={styles.logoFallback} src={logoUrl} alt="" />}
          </Avatar>
          <Box>
            <Title order={2}>{title}</Title>
            <Text c="gray.3" mt={5}>
              {status || t('profileHero.noStatus')}
            </Text>
            <Text size="xs" c="dimmed" mt={5}>
              {rank ? `${rank.tier} ${rank.division} · ${rank.queue}` : t('profileHero.noRank')}
            </Text>
          </Box>
        </Group>
      </Stack>
    </Paper>
  );
}
