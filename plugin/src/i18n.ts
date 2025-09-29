import tinyI18n, { createIsolateI18n } from "./i18n-wrapper";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

const instance = createIsolateI18n();

const LOCALE_TABLE = [
  ["en", en],
  ["ru", ru],
] as const;

type SupportedLocale = (typeof LOCALE_TABLE)[number][0];

type LocaleDictionary = Record<string, string>;

const dictionaries: Record<SupportedLocale, LocaleDictionary> = Object.fromEntries(
  LOCALE_TABLE.map(([code, dict]) => [code, dict as LocaleDictionary]),
) as Record<SupportedLocale, LocaleDictionary>;

const supportedLocales: SupportedLocale[] = LOCALE_TABLE.map(([code]) => code);

const FALLBACK_LOCALE: SupportedLocale = "en";

for (const [code, dict] of LOCALE_TABLE) {
  instance.setDictionary(dict as LocaleDictionary, code);
}

let currentLocale: SupportedLocale = FALLBACK_LOCALE;
instance.setLanguage(FALLBACK_LOCALE);

function matchLocale(locale: string | undefined | null): SupportedLocale | null {
  if (!locale) return null;
  const lower = locale.toLowerCase();
  for (const code of supportedLocales) {
    if (lower === code || lower.startsWith(`${code}-`)) return code;
  }
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
    return matchLocale(preference) ?? FALLBACK_LOCALE;
  }

  for (const candidate of candidates) {
    const normalized = matchLocale(candidate);
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

export const availableLocales: SupportedLocale[] = [...supportedLocales];

