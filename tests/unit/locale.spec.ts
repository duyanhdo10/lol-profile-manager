import { describe, expect, it } from 'vitest';
import {
  LOCALE_MODE_STORAGE_KEY,
  mapLocale,
  readLocaleMode,
  resolveLocale,
  writeLocaleMode,
} from '../../src/renderer/features/settings/i18n/locale';

describe('locale preferences', () => {
  it('maps every Vietnamese Riot locale to vi_VN and falls back to English', () => {
    expect(mapLocale('vi_VN')).toBe('vi_VN');
    expect(mapLocale('vi-VN')).toBe('vi_VN');
    expect(mapLocale('en_US')).toBe('en_US');
    expect(mapLocale('th_TH')).toBe('en_US');
  });

  it('uses the client locale in Auto and preserves manual overrides', () => {
    expect(resolveLocale('auto', { locale: 'vi_VN' }, 'en-US')).toBe('vi_VN');
    expect(resolveLocale('auto', null, 'vi-VN')).toBe('vi_VN');
    expect(resolveLocale('en_US', { locale: 'vi_VN' }, 'vi-VN')).toBe('en_US');
  });

  it('persists only supported locale modes', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    writeLocaleMode('vi_VN', storage);
    expect(values.get(LOCALE_MODE_STORAGE_KEY)).toBe('vi_VN');
    expect(readLocaleMode(storage)).toBe('vi_VN');
    values.set(LOCALE_MODE_STORAGE_KEY, 'unsupported');
    expect(readLocaleMode(storage)).toBe('auto');
  });
});
