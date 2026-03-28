import { useLanguage } from '../context/LanguageContext';
import { languages, Language } from '../i18n';

export default function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { language, setLanguage } = useLanguage();

  if (compact) {
    return (
      <select
        value={language}
        onChange={e => setLanguage(e.target.value as Language)}
        className="bg-transparent text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-300 cursor-pointer"
      >
        {Object.entries(languages).map(([key, { name, flag }]) => (
          <option key={key} value={key}>{flag} {name}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex gap-1">
      {Object.entries(languages).map(([key, { flag }]) => (
        <button
          key={key}
          onClick={() => setLanguage(key as Language)}
          className={`px-2 py-1 rounded text-sm transition-colors ${
            language === key
              ? 'bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/30'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          title={languages[key as Language].name}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}
