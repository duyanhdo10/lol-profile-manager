import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { mapLocale } from './locale';
import { en, vi } from './resources';

void i18n.use(initReactI18next).init({
  resources: {
    en_US: { translation: en },
    vi_VN: { translation: vi },
  },
  lng: mapLocale(typeof navigator === 'undefined' ? 'en_US' : navigator.language),
  fallbackLng: 'en_US',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export { i18n };
export * from './locale';
