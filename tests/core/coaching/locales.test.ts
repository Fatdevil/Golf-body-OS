import { LOCALES, getPhrase, SupportedLanguage, CoachingPhraseKey } from '../../../src/core/coaching/i18n/locales';

describe('Locales Dictionary (i18n)', () => {
  const languages: SupportedLanguage[] = ['en-US', 'sv-SE'];

  it('should have all phrase keys defined in all supported languages', () => {
    const enKeys = Object.keys(LOCALES['en-US']) as CoachingPhraseKey[];
    expect(enKeys.length).toBeGreaterThan(15);

    for (const lang of languages) {
      const langKeys = Object.keys(LOCALES[lang]);
      expect(langKeys.sort()).toEqual(enKeys.sort());

      // Every key should map to a non-empty string
      for (const key of enKeys) {
        expect(typeof LOCALES[lang][key]).toBe('string');
        expect(LOCALES[lang][key].length).toBeGreaterThan(0);
      }
    }
  });

  it('should fallback to en-US for unknown languages or missing keys', () => {
    expect(getPhrase('COUNTDOWN_GO', 'en-US')).toBe('Go!');
    expect(getPhrase('COUNTDOWN_GO', 'sv-SE')).toBe('Kör!');
    expect(getPhrase('COUNTDOWN_GO', 'fr-FR' as any)).toBe('Go!');
  });
});
