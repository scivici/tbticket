import en from './en.json';
import fr from './fr.json';
import tr from './tr.json';

export const languages = {
  en: { name: 'English', flag: '🇬🇧', translations: en },
  fr: { name: 'Français', flag: '🇫🇷', translations: fr },
  tr: { name: 'Türkçe', flag: '🇹🇷', translations: tr },
} as const;

export type Language = keyof typeof languages;
export type TranslationKeys = typeof en;

export function getNestedValue(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) || path;
}
