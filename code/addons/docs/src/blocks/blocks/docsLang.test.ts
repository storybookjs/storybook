import { describe, expect, it } from 'vitest';

import { resolveDocsLang } from './docsLang';

describe('resolveDocsLang', () => {
  it('returns the docs.lang from resolved parameters', () => {
    expect(resolveDocsLang({ docs: { lang: 'de' } })).toBe('de');
  });

  it('falls back to project parameters when resolved has none', () => {
    expect(resolveDocsLang({}, { docs: { lang: 'fr' } })).toBe('fr');
  });

  it('defaults to en when neither is set', () => {
    expect(resolveDocsLang(undefined, undefined)).toBe('en');
  });

  it('prefers resolved over project', () => {
    expect(resolveDocsLang({ docs: { lang: 'de' } }, { docs: { lang: 'fr' } })).toBe('de');
  });
});
