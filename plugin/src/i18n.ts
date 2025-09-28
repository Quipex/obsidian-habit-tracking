import tinyI18n from "tiny-i18n";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const { createIsolateI18n } = tinyI18n;
const instance = createIsolateI18n();

const dictionaries = {
  en: en as Record<string, string>,
  ru: ru as Record<string, string>,
};

type SupportedLocale = keyof typeof dictionaries;

const FALLBACK_LOCALE: SupportedLocale = "en";

Object.entries(dictionaries).forEach(([locale, dict]) => {
  instance.setDictionary(dict as Record<string, string>, locale);
});

let currentLocale: SupportedLocale = FALLBACK_LOCALE;
instance.setLanguage(FALLBACK_LOCALE);

function normalizeLocale(locale: string | undefined | null): SupportedLocale | null {
  if (!locale) return null;
  const normalized = locale.toLowerCase();
  if (normalized.startsWith("ru")) return "ru";
  if (normalized.startsWith("en")) return "en";
  return null;
}

function setResolvedLocale(locale: SupportedLocale): void {
  currentLocale = locale;
  instance.setLanguage(locale);
}

export type LocalePreference = "auto" | SupportedLocale;

export function resolveLocale(
  preference: LocalePreference,
  candidates: Array<string | undefined | null>,
): SupportedLocale {
  if (preference !== "auto") {
    return normalizeLocale(preference) ?? FALLBACK_LOCALE;
  }

  for (const candidate of candidates) {
    const normalized = normalizeLocale(candidate);
    if (normalized) return normalized;
  }

  return FALLBACK_LOCALE;
}

export function applyLocale(
  preference: LocalePreference,
  candidates: Array<string | undefined | null>,
): SupportedLocale {
  const locale = resolveLocale(preference, candidates);
  setResolvedLocale(locale);
  return locale;
}

export function getLocale(): SupportedLocale {
  return currentLocale;
}

export function t(key: string, ...args: Array<string | number>): string {
  const translated = instance.i18n(key, ...args.map(String));
  return translated ?? key;
}

export const availableLocales: SupportedLocale[] = ["en", "ru"];
