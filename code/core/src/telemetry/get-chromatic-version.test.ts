import { expect, it } from 'vitest';

import { getChromaticVersionSpecifier } from './get-chromatic-version';

it('works for dependencies', () => {
  expect(getChromaticVersionSpecifier({ dependencies: { chromatic: '^6.11.4' } })).toBe('^6.11.4');
});

it('works for scripts', () => {
  expect(getChromaticVersionSpecifier({ scripts: { chromatic: 'npx chromatic -t abc123' } })).toBe(
    'latest'
  );
});

it('fails otherwise', () => {
  expect(getChromaticVersionSpecifier({})).toBeUndefined();
});
