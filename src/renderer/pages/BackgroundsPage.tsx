import { Badge, Button, Card, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetCard } from '../components/AssetCard';
import { VirtualGrid } from '../components/VirtualGrid';
import { useProfilePreview } from '../hooks/use-profile-preview';
import { useAppStore } from '../store/app-store';
import { cssVariables } from '../styles/css-variables';
import styles from './PickerPages.module.css';

export function BackgroundsPage() {
  const { t } = useTranslation();
  const catalog = useAppStore((state) => state.catalog);
  const draft = useAppStore((state) => state.draft);
  const patchDraft = useAppStore((state) => state.patchDraft);
  const clearField = useAppStore((state) => state.clearField);
  const catalogBusy = useAppStore((state) => state.catalogBusy);
  const preview = useProfilePreview();
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState('all');
  const [rarity, setRarity] = useState('all');
  const [champion, setChampion] = useState('');
  const rarities = useMemo(
    () =>
      [...new Set((catalog?.backgrounds ?? []).flatMap((item) => (item.rarity ? [item.rarity] : [])))].sort(),
    [catalog],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.backgrounds ?? []).filter(
      (item) =>
        (!query || `${item.name} ${item.champion ?? ''} ${item.id}`.toLowerCase().includes(query)) &&
        (!champion || item.champion?.toLowerCase().includes(champion.toLowerCase())) &&
        (ownership === 'all' || item.ownership === ownership) &&
        (rarity === 'all' || item.rarity === rarity),
    );
  }, [catalog, champion, ownership, rarity, search]);
  const ownershipOptions = [
    { value: 'all', label: t('backgrounds.allOwnership') },
    { value: 'owned', label: t('common.owned') },
    { value: 'unowned', label: t('common.unowned') },
    { value: 'unknown', label: t('common.unknown') },
  ];

  return (
    <Stack gap="md">
      <Card
        className={styles.backgroundHero}
        style={cssVariables({
          '--background-image': preview.background ? `url("${preview.background.imageUrl}")` : 'none',
        })}
      >
        <div>
          <Text className={styles.eyebrow}>{t('backgrounds.preview')}</Text>
          <Title order={2}>{preview.background?.name ?? t('backgrounds.choose')}</Title>
          <Text c="gray.4">{preview.background?.champion ?? t('backgrounds.currentArtwork')}</Text>
          <Badge mt="md" color="hexgold" variant="light">
            {t('backgrounds.self')}
          </Badge>
        </div>
        {draft.backgroundSkinId !== undefined && (
          <Button variant="light" color="gray" onClick={() => clearField('background')}>
            {t('backgrounds.useCurrent')}
          </Button>
        )}
      </Card>
      <Card className={styles.catalogPanel}>
        <Group justify="space-between" mb="md">
          <div>
            <Text className={styles.eyebrow}>{t('backgrounds.art')}</Text>
            <Title order={3}>{t('backgrounds.catalog')}</Title>
          </div>
          <Badge variant="light">{t('common.results', { count: filtered.length })}</Badge>
        </Group>
        <Group grow align="flex-end" mb="md" wrap="nowrap">
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            leftSection={<IconSearch size={16} />}
            placeholder={t('backgrounds.search')}
            aria-label={t('backgrounds.searchAria')}
          />
          <TextInput
            value={champion}
            onChange={(event) => setChampion(event.currentTarget.value)}
            placeholder={t('backgrounds.champion')}
            aria-label={t('backgrounds.champion')}
          />
          <Select
            value={ownership}
            onChange={(value) => setOwnership(value ?? 'all')}
            data={ownershipOptions}
            aria-label={t('common.ownership')}
          />
          <Select
            value={rarity}
            onChange={(value) => setRarity(value ?? 'all')}
            data={[
              { value: 'all', label: t('backgrounds.allRarities') },
              ...rarities.map((value) => ({ value, label: value })),
            ]}
            aria-label={t('common.rarity')}
          />
        </Group>
        <VirtualGrid
          items={filtered}
          columns={2}
          rowHeight={110}
          getKey={(item) => item.id}
          empty={catalogBusy ? t('backgrounds.loading') : t('backgrounds.empty')}
          renderItem={(item) => (
            <AssetCard
              item={item}
              wide
              selected={draft.backgroundSkinId === item.id}
              onSelect={() => patchDraft({ backgroundSkinId: item.id })}
            />
          )}
        />
      </Card>
    </Stack>
  );
}
