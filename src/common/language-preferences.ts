import type { LangCode } from './lang'

export const USER_SELECTABLE_TRANSLATION_LANGS = ['zh-Hans', 'en', 'ja'] as const satisfies readonly LangCode[]

const CHINESE_FAMILY_LANGS = ['zh-Hans', 'zh-Hant', 'yue', 'lzh', 'jdbhw', 'xdbhw'] as const
const ENGLISH_FAMILY_LANGS = ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU'] as const

export function isChineseFamilyLang(langCode: string | null | undefined): boolean {
    return !!langCode && (CHINESE_FAMILY_LANGS as readonly string[]).includes(langCode)
}

export function normalizeSelectableTranslationLang(
    langCode: string | null | undefined,
    fallback: LangCode = 'en'
): LangCode {
    if (!langCode) {
        return fallback
    }
    if ((ENGLISH_FAMILY_LANGS as readonly string[]).includes(langCode)) {
        return 'en'
    }
    if ((CHINESE_FAMILY_LANGS as readonly string[]).includes(langCode)) {
        return 'zh-Hans'
    }
    if (langCode === 'ja') {
        return 'ja'
    }
    return fallback
}
