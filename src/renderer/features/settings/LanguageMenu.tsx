import { Button, Menu } from '@mantine/core';
import { IconCheck, IconLanguage } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import type { LocaleMode } from '../../../shared/models';
import { useAppStore } from '../../store/app-store';

const modes: Array<{ mode: LocaleMode; key: 'auto' | 'vi' | 'en' }> = [
  { mode: 'auto', key: 'auto' },
  { mode: 'vi_VN', key: 'vi' },
  { mode: 'en_US', key: 'en' },
];

export function LanguageMenu() {
  const { t } = useTranslation();
  const locale = useAppStore((state) => state.locale);
  const localeMode = useAppStore((state) => state.localeMode);
  const setLocaleMode = useAppStore((state) => state.setLocaleMode);

  return (
    <Menu position="bottom-end" width={220}>
      <Menu.Target>
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconLanguage size={17} />}
          aria-label={t('language.label')}
        >
          {locale === 'vi_VN' ? 'VI' : 'EN'}
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{t('language.label')}</Menu.Label>
        {modes.map(({ mode, key }) => (
          <Menu.Item
            key={mode}
            onClick={() => void setLocaleMode(mode)}
            rightSection={localeMode === mode ? <IconCheck size={15} /> : null}
          >
            {t(`language.${key}`)}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
