import en from "./locales/en.json";
import ru from "./locales/ru.json";

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

let currentLocale: SupportedLocale = FALLBACK_LOCALE;

function format(template: string, values: Array<string>): string {
  return template.replace(/\$\{(\d+)\}/g, (_match, indexRaw) => {
    const index = Number(indexRaw) - 1;
    return index >= 0 && index < values.length ? values[index] : "";
  });
}

function translate(key: string, args: Array<string>): string {
  const localeDict = dictionaries[currentLocale] ?? {};
  const fallbackDict = dictionaries[FALLBACK_LOCALE] ?? {};
  const template = localeDict[key] ?? fallbackDict[key];
  if (!template) return key;
  return format(template, args);
}

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
  return translate(key, args.map(String));
}

export const availableLocales: SupportedLocale[] = [...supportedLocales];
