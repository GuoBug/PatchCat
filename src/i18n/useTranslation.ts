import { useSettingsStore } from '../stores/settings-store.ts';
import { translations, type Translations } from './translations.ts';

export function useTranslation(): { t: Translations; language: 'en' | 'zh'; setLanguage: (lang: 'en' | 'zh') => void } {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  const t = translations[language] || translations.en;

  return { t, language, setLanguage };
}
