import { useMemo } from 'react';
import type { ChallengeShowcase } from '../../shared/models';
import { useAppStore } from '../store/app-store';

export function useProfilePreview() {
  const catalog = useAppStore((state) => state.catalog);
  const current = useAppStore((state) => state.current);
  const draft = useAppStore((state) => state.draft);

  return useMemo(() => {
    const iconId = draft.iconId ?? current.iconId;
    const backgroundSkinId = draft.backgroundSkinId ?? current.backgroundSkinId;
    const showcase: ChallengeShowcase = { ...current.challengeShowcase, ...draft.challengeShowcase };
    const regalia = draft.regalia ?? current.regalia;
    return {
      icon: catalog?.icons.find((item) => item.id === iconId),
      background: catalog?.backgrounds.find((item) => item.id === backgroundSkinId),
      title: catalog?.titles.find((item) => item.contentId === showcase.titleContentId),
      tokens: (showcase.tokenIds ?? []).flatMap((id) => catalog?.tokens.find((item) => item.id === id) ?? []),
      banner: catalog?.regalia.find(
        (item) => item.id === showcase.bannerAccent || item.contentId === showcase.bannerAccent,
      ),
      showcase,
      regalia,
      status: draft.statusMessage ?? current.statusMessage,
      rank: draft.rank ?? current.rank,
    };
  }, [catalog, current, draft]);
}
