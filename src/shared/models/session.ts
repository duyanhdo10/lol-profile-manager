export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'incompatible';

export type AppLocale = 'en_US' | 'vi_VN';
export type LocaleMode = 'auto' | AppLocale;

export interface ClientLocale {
  locale: string;
  region?: string;
}
