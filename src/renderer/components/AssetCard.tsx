import { Badge, Box, Image, Paper, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import type { CatalogItem } from '../../shared/models';
import styles from './AssetCard.module.css';

interface AssetCardProps {
  item: CatalogItem;
  selected: boolean;
  wide?: boolean;
  onSelect(): void;
}

export function AssetCard({ item, selected, wide = false, onSelect }: AssetCardProps) {
  const { t } = useTranslation();
  return (
    <Paper
      component="button"
      type="button"
      className={styles.card}
      data-selected={selected || undefined}
      data-wide={wide || undefined}
      onClick={onSelect}
    >
      <Image
        src={item.imageUrl}
        alt={item.name}
        className={styles.image}
        radius="sm"
        fallbackSrc="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
      />
      <Box className={styles.copy}>
        <Text fw={700} size="sm" truncate>
          {item.name}
        </Text>
        <Text size="xs" c="dimmed" truncate>
          {item.champion ? `${item.champion} · ` : ''}#{item.id}
          {item.rarity ? ` · ${item.rarity}` : ''}
        </Text>
      </Box>
      <Stack gap={4} align="flex-end">
        <Badge
          size="xs"
          color={item.ownership === 'owned' ? 'teal' : item.ownership === 'unowned' ? 'orange' : 'gray'}
          variant="light"
        >
          {t(`common.${item.ownership}`)}
        </Badge>
        {item.compatibility === 'not-compatible' && (
          <Badge size="xs" color="red" variant="light">
            {t('asset.rejected')}
          </Badge>
        )}
      </Stack>
    </Paper>
  );
}
