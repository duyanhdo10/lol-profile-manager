import {
  Badge,
  Button,
  Card,
  Group,
  Image,
  NumberInput,
  Paper,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconArrowLeft, IconArrowRight, IconSearch, IconX } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import type { BannerMode, ChallengeShowcase, CrestMode } from '../../shared/models';
import { VirtualGrid } from '../components/VirtualGrid';
import { useProfilePreview } from '../hooks/use-profile-preview';
import { useAppStore } from '../store/app-store';
import { cssVariables } from '../styles/css-variables';
import styles from './ShowcasePage.module.css';

const tabs = new Set(['title', 'tokens', 'banner', 'regalia']);

export function ShowcasePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const activeTab = tabs.has(params.tab ?? '') ? params.tab! : 'title';
  const catalog = useAppStore((state) => state.catalog);
  const draft = useAppStore((state) => state.draft);
  const patchDraft = useAppStore((state) => state.patchDraft);
  const clearField = useAppStore((state) => state.clearField);
  const preview = useProfilePreview();
  const [search, setSearch] = useState('');
  const [ownership, setOwnership] = useState('all');
  const [tier, setTier] = useState('all');
  const [category, setCategory] = useState('all');

  const updateShowcase = (patch: Partial<ChallengeShowcase>) =>
    patchDraft({ challengeShowcase: { ...preview.showcase, ...patch } });
  const toggleToken = (id: number) => {
    const tokenIds = [...(preview.showcase.tokenIds ?? [])];
    const index = tokenIds.indexOf(id);
    if (index >= 0) tokenIds.splice(index, 1);
    else if (tokenIds.length < 3) tokenIds.push(id);
    updateShowcase({ tokenIds });
  };
  const moveToken = (index: number, direction: -1 | 1) => {
    const tokenIds = [...(preview.showcase.tokenIds ?? [])];
    const target = index + direction;
    if (target < 0 || target >= tokenIds.length) return;
    [tokenIds[index], tokenIds[target]] = [tokenIds[target]!, tokenIds[index]!];
    updateShowcase({ tokenIds });
  };
  const categories = useMemo(
    () =>
      [
        ...new Set(
          [...(catalog?.titles ?? []), ...(catalog?.tokens ?? [])].flatMap((item) =>
            item.category ? [item.category] : [],
          ),
        ),
      ].sort(),
    [catalog],
  );
  const matches = (
    item: { name: string; ownership: string; tier?: string; category?: string },
    id: string | number,
  ) => {
    const query = search.trim().toLowerCase();
    return (
      (!query || `${item.name} ${id}`.toLowerCase().includes(query)) &&
      (ownership === 'all' || item.ownership === ownership) &&
      (tier === 'all' || item.tier === tier) &&
      (category === 'all' || item.category === category)
    );
  };
  const titles = (catalog?.titles ?? []).filter((item) => matches(item, item.contentId));
  const tokens = (catalog?.tokens ?? []).filter((item) => matches(item, item.id));
  const banners = (catalog?.regalia ?? []).filter((item) => matches(item, item.contentId));
  const resultCount =
    activeTab === 'title' ? titles.length : activeTab === 'tokens' ? tokens.length : banners.length;
  const ownershipOptions = [
    { value: 'all', label: t('common.all') },
    { value: 'owned', label: t('common.owned') },
    { value: 'unowned', label: t('common.unowned') },
    { value: 'unknown', label: t('common.unknown') },
  ];

  return (
    <Stack gap="md">
      <Paper
        className={styles.hero}
        style={cssVariables({
          '--showcase-background': preview.banner ? `url("${preview.banner.imageUrl}")` : 'none',
        })}
      >
        <div>
          <Text className={styles.eyebrow}>{t('showcase.preview')}</Text>
          <Title order={2}>{preview.title?.name ?? t('showcase.noTitle')}</Title>
          <Text c="dimmed">{preview.banner?.name ?? t('showcase.currentBanner')}</Text>
          <Group mt="lg" gap="sm">
            {preview.tokens.map((token, index) => (
              <div key={token.id} className={styles.heroToken}>
                <Image src={token.imageUrl} alt={token.name} />
                <Badge circle>{index + 1}</Badge>
              </div>
            ))}
            {[0, 1, 2].slice(preview.tokens.length).map((slot) => (
              <div key={slot} className={styles.emptyToken}>
                +
              </div>
            ))}
          </Group>
        </div>
        <div className={styles.regaliaCrystal}>
          <span>{preview.regalia.selectedPrestigeCrest}</span>
          <Text fw={700}>{t('showcase.crest', { mode: preview.regalia.preferredCrestType })}</Text>
          <Text size="xs" c="dimmed">
            {preview.regalia.preferredBannerType}
          </Text>
        </div>
      </Paper>

      <Card className={styles.editor}>
        <Tabs
          className={styles.tabs}
          value={activeTab}
          onChange={(value) => navigate(`/showcase/${value ?? 'title'}`)}
        >
          <Tabs.List>
            <Tabs.Tab value="title">{t('showcase.title')}</Tabs.Tab>
            <Tabs.Tab value="tokens">
              {t('showcase.tokens')}{' '}
              <Badge size="xs" ml={6}>
                {preview.tokens.length}/3
              </Badge>
            </Tabs.Tab>
            <Tabs.Tab value="banner">{t('showcase.banner')}</Tabs.Tab>
            <Tabs.Tab value="regalia">{t('showcase.regalia')}</Tabs.Tab>
          </Tabs.List>
          {activeTab !== 'regalia' && (
            <Group grow mt="md" wrap="nowrap" className={styles.filters}>
              <TextInput
                value={search}
                onChange={(event) => setSearch(event.currentTarget.value)}
                leftSection={<IconSearch size={16} />}
                placeholder={t('showcase.search', { tab: t(`showcase.${activeTab}`) })}
              />
              <Select
                value={ownership}
                onChange={(value) => setOwnership(value ?? 'all')}
                data={ownershipOptions}
              />
              {activeTab !== 'banner' && (
                <Select
                  value={tier}
                  onChange={(value) => setTier(value ?? 'all')}
                  data={[
                    'all',
                    'IRON',
                    'BRONZE',
                    'SILVER',
                    'GOLD',
                    'PLATINUM',
                    'DIAMOND',
                    'MASTER',
                    'GRANDMASTER',
                    'CHALLENGER',
                  ]}
                />
              )}
              {activeTab !== 'banner' && (
                <Select
                  value={category}
                  onChange={(value) => setCategory(value ?? 'all')}
                  data={[
                    { value: 'all', label: t('common.all') },
                    ...categories.map((value) => ({ value, label: value })),
                  ]}
                />
              )}
              <Text size="xs" c="dimmed" className={styles.resultCount}>
                {t('common.results', { count: resultCount })}
              </Text>
            </Group>
          )}

          <Tabs.Panel value="title" pt="md" className={styles.panel}>
            <VirtualGrid
              items={titles}
              columns={1}
              rowHeight={76}
              getKey={(item) => item.contentId}
              empty={t('showcase.noTitles')}
              fillHeight
              measureKey={activeTab}
              testId="titles-grid"
              renderItem={(item) => (
                <button
                  type="button"
                  className={styles.listItem}
                  data-selected={preview.showcase.titleContentId === item.contentId || undefined}
                  onClick={() => updateShowcase({ titleContentId: item.contentId })}
                >
                  <span className={styles.titleGlyph}>T</span>
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {item.category ?? t('showcase.challengeTitle')} ·{' '}
                      {item.tier ?? item.acquisitionType ?? t('common.standard')}
                    </small>
                  </span>
                  <Badge color={item.ownership === 'owned' ? 'teal' : 'orange'} variant="light">
                    {t(`common.${item.ownership}`)}
                  </Badge>
                </button>
              )}
            />
          </Tabs.Panel>
          <Tabs.Panel value="tokens" pt="md" className={styles.panel}>
            <Group className={styles.tokenSlots} align="stretch">
              {preview.tokens.map((token, index) => (
                <Paper key={token.id} className={styles.tokenSlot}>
                  <Image src={token.imageUrl} alt={token.name} />
                  <div>
                    <Text fw={700} size="sm">
                      {token.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {t('showcase.slot', { number: index + 1 })}
                    </Text>
                  </div>
                  <Button.Group>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => moveToken(index, -1)}
                      disabled={index === 0}
                    >
                      <IconArrowLeft size={14} />
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      onClick={() => moveToken(index, 1)}
                      disabled={index === preview.tokens.length - 1}
                    >
                      <IconArrowRight size={14} />
                    </Button>
                    <Button
                      size="compact-xs"
                      color="red"
                      variant="subtle"
                      onClick={() => toggleToken(token.id)}
                    >
                      <IconX size={14} />
                    </Button>
                  </Button.Group>
                </Paper>
              ))}
              {preview.tokens.length === 0 && (
                <Text c="dimmed" size="sm">
                  {t('showcase.chooseTokens')}
                </Text>
              )}
            </Group>
            <VirtualGrid
              items={tokens}
              columns={3}
              rowHeight={118}
              getKey={(item) => item.id}
              empty={t('showcase.noTokens')}
              fillHeight
              measureKey={activeTab}
              testId="tokens-grid"
              renderItem={(item) => (
                <button
                  type="button"
                  className={styles.tokenCard}
                  data-selected={preview.showcase.tokenIds?.includes(item.id) || undefined}
                  disabled={preview.tokens.length >= 3 && !preview.showcase.tokenIds?.includes(item.id)}
                  onClick={() => toggleToken(item.id)}
                >
                  <Image src={item.imageUrl} alt={item.name} />
                  <strong>{item.name}</strong>
                  <small>
                    {item.tier ?? t('common.standard')} · {t(`common.${item.ownership}`)}
                  </small>
                </button>
              )}
            />
          </Tabs.Panel>
          <Tabs.Panel value="banner" pt="md" className={styles.panel}>
            <Text size="xs" c="dimmed" mb="sm">
              {t('showcase.bannerShowcaseNote')}
            </Text>
            <VirtualGrid
              items={banners}
              columns={2}
              rowHeight={112}
              getKey={(item) => item.contentId}
              empty={t('showcase.noBanners')}
              fillHeight
              measureKey={activeTab}
              testId="banners-grid"
              renderItem={(item) => (
                <button
                  type="button"
                  className={styles.bannerCard}
                  data-selected={
                    preview.showcase.bannerAccent === item.id ||
                    preview.showcase.bannerAccent === item.contentId ||
                    undefined
                  }
                  onClick={() => updateShowcase({ bannerAccent: item.id })}
                >
                  <Image src={item.imageUrl} alt={item.name} />
                  <span>
                    <strong>{item.name}</strong>
                    <small>
                      {t(`common.${item.ownership}`)} · {t('showcase.profileHovercard')}
                    </small>
                  </span>
                </button>
              )}
            />
          </Tabs.Panel>
          <Tabs.Panel value="regalia" pt="xl">
            <Stack maw={760}>
              <Group justify="space-between">
                <div>
                  <Text className={styles.eyebrow}>{t('showcase.lcuRegalia')}</Text>
                  <Title order={3}>{t('showcase.crestAppearance')}</Title>
                </div>
                <Badge color="hexgold" variant="light">
                  {t('showcase.profileHovercard')}
                </Badge>
              </Group>
              <Group grow align="flex-start">
                <Select
                  label={t('showcase.crestMode')}
                  value={preview.regalia.preferredCrestType}
                  data={[
                    { value: 'prestige', label: t('showcase.prestige') },
                    { value: 'ranked', label: t('showcase.ranked') },
                  ]}
                  onChange={(value) =>
                    patchDraft({
                      regalia: { ...preview.regalia, preferredCrestType: (value ?? 'prestige') as CrestMode },
                    })
                  }
                />
                <Select
                  label={t('showcase.bannerMode')}
                  value={preview.regalia.preferredBannerType}
                  data={[
                    { value: 'blank', label: t('showcase.blank') },
                    { value: 'lastSeasonHighestRank', label: t('showcase.lastSeason') },
                    { value: 'highestRank', label: t('showcase.highest') },
                  ]}
                  onChange={(value) =>
                    patchDraft({
                      regalia: {
                        ...preview.regalia,
                        preferredBannerType: (value ?? 'lastSeasonHighestRank') as BannerMode,
                      },
                    })
                  }
                />
                <NumberInput
                  label={t('showcase.prestigeLevel')}
                  min={0}
                  max={255}
                  value={preview.regalia.selectedPrestigeCrest}
                  onChange={(value) =>
                    patchDraft({
                      regalia: {
                        ...preview.regalia,
                        selectedPrestigeCrest: typeof value === 'number' ? value : 0,
                      },
                    })
                  }
                />
              </Group>
              <Text size="xs" c="dimmed">
                {t('showcase.regaliaNote')}
              </Text>
              <Group grow>
                <Paper p="md" withBorder>
                  <Text size="xs" c="dimmed">
                    {t('showcase.resolvedCrest')}
                  </Text>
                  <Text fw={700}>{preview.regaliaContext.resolvedCrest}</Text>
                </Paper>
                <Paper p="md" withBorder>
                  <Text size="xs" c="dimmed">
                    {t('showcase.accountLevel')}
                  </Text>
                  <Text fw={700}>{preview.regaliaContext.accountLevel}</Text>
                </Paper>
                <Paper p="md" withBorder>
                  <Text size="xs" c="dimmed">
                    {t('showcase.rankContext')}
                  </Text>
                  <Text fw={700}>
                    {preview.regaliaContext.highestRank ?? t('presence.unranked')} ·{' '}
                    {preview.regaliaContext.lastSeasonHighestRank ?? t('presence.unranked')}
                  </Text>
                </Paper>
              </Group>
              <Text size="xs" c="dimmed">
                {t('showcase.prestigeLevelNote')}
              </Text>
              {draft.regalia && (
                <Button variant="light" color="gray" w="fit-content" onClick={() => clearField('regalia')}>
                  {t('showcase.keepRegalia')}
                </Button>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
        {draft.challengeShowcase && (
          <Group justify="space-between" mt="md">
            <Text size="xs" c="dimmed">
              {t('showcase.reviewNote')}
            </Text>
            <Button variant="subtle" color="gray" onClick={() => clearField('challengeShowcase')}>
              {t('showcase.keepShowcase')}
            </Button>
          </Group>
        )}
      </Card>
    </Stack>
  );
}
