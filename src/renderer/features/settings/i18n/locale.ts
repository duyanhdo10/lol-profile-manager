import type { AppLocale, ClientLocale, LocaleMode } from '../../../../shared/models';

export const LOCALE_MODE_STORAGE_KEY = 'lpm.locale-mode';

export function mapLocale(value: string | null | undefined): AppLocale {
  return value?.trim().toLowerCase().replace('-', '_').startsWith('vi') ? 'vi_VN' : 'en_US';
}

export function readLocaleMode(storage: Pick<Storage, 'getItem'> = localStorage): LocaleMode {
  const value = storage.getItem(LOCALE_MODE_STORAGE_KEY);
  return value === 'vi_VN' || value === 'en_US' || value === 'auto' ? value : 'auto';
}

export function writeLocaleMode(mode: LocaleMode, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(LOCALE_MODE_STORAGE_KEY, mode);
}

export function resolveLocale(
  mode: LocaleMode,
  clientLocale: ClientLocale | null,
  browserLocale: string,
): AppLocale {
  if (mode !== 'auto') return mode;
  return mapLocale(clientLocale?.locale ?? browserLocale);
}
