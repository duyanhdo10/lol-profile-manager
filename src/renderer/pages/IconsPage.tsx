import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Image,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconSearch, IconUserCircle } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AssetCard } from '../components/AssetCard';
import { VirtualGrid } from '../components/VirtualGrid';
import { useProfilePreview } from '../hooks/use-profile-preview';
import { useAppStore } from '../store/app-store';
import styles from './PickerPages.module.css';

export function IconsPage() {
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
  const [year, setYear] = useState('');
  const rarities = useMemo(
    () => [...new Set((catalog?.icons ?? []).flatMap((item) => (item.rarity ? [item.rarity] : [])))].sort(),
    [catalog],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (catalog?.icons ?? []).filter(
      (item) =>
        (!query || `${item.name} ${item.id}`.toLowerCase().includes(query)) &&
        (ownership === 'all' || item.ownership === ownership) &&
        (rarity === 'all' || item.rarity === rarity) &&
        (!year || item.year === Number(year)),
    );
  }, [catalog, ownership, rarity, search, year]);
  const ownershipOptions = [
    { value: 'all', label: t('icons.allOwnership') },
    { value: 'owned', label: t('common.owned') },
    { value: 'unowned', label: t('common.unowned') },
    { value: 'unknown', label: t('common.unknown') },
  ];

  return (
    <Grid align="stretch">
      <Grid.Col span={{ base: 8, xl: 9 }}>
        <Card className={styles.catalogPanel}>
          <Group justify="space-between" mb="md">
            <div>
              <Text className={styles.eyebrow}>{t('icons.source')}</Text>
              <Title order={3}>{t('icons.collection')}</Title>
            </div>
            <Badge variant="light">{t('common.results', { count: filtered.length })}</Badge>
          </Group>
          <Group grow align="flex-end" mb="md" wrap="nowrap">
            <TextInput
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              placeholder={t('icons.search')}
              aria-label={t('icons.searchAria')}
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
                { value: 'all', label: t('icons.allRarities') },
                ...rarities.map((value) => ({ value, label: value })),
              ]}
              aria-label={t('common.rarity')}
            />
            <TextInput
              value={year}
              onChange={(event) => setYear(event.currentTarget.value)}
              type="number"
              placeholder={t('common.year')}
              aria-label={t('common.year')}
            />
          </Group>
          <VirtualGrid
            items={filtered}
            columns={2}
            rowHeight={90}
            getKey={(item) => item.id}
            empty={catalogBusy ? t('icons.loading') : t('icons.empty')}
            renderItem={(item) => (
              <AssetCard
                item={item}
                selected={draft.iconId === item.id}
                onSelect={() => patchDraft({ iconId: item.id })}
              />
            )}
          />
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 4, xl: 3 }}>
        <Paper className={styles.selectionPanel}>
          <Text className={styles.eyebrow}>{t('icons.preview')}</Text>
          <Title order={3} mt={4}>
            {preview.icon?.name ?? t('icons.choose')}
          </Title>
          <div className={styles.iconStage}>
            {preview.icon ? (
              <Image src={preview.icon.imageUrl} alt={preview.icon.name} />
            ) : (
              <IconUserCircle size={76} stroke={1} />
            )}
          </div>
          {preview.icon && (
            <Stack gap="xs">
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  {t('icons.id')}
                </Text>
                <Text fw={700}>#{preview.icon.id}</Text>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  {t('common.ownership')}
                </Text>
                <Badge color={preview.icon.ownership === 'owned' ? 'teal' : 'orange'}>
                  {t(`common.${preview.icon.ownership}`)}
                </Badge>
              </Group>
              <Group justify="space-between">
                <Text c="dimmed" size="sm">
                  {t('icons.visibility')}
                </Text>
                <Text size="sm">{t('icons.friends')}</Text>
              </Group>
            </Stack>
          )}
          <Text size="xs" c="dimmed" mt="lg">
            {t('icons.note')}
          </Text>
          {draft.iconId !== undefined && (
            <Button fullWidth mt="lg" variant="light" color="gray" onClick={() => clearField('icon')}>
              {t('icons.useCurrent')}
            </Button>
          )}
        </Paper>
      </Grid.Col>
    </Grid>
  );
}
