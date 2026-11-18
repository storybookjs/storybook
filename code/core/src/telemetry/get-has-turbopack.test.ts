import { expect, it } from 'vitest';

import { getHasTurbopack } from './get-has-turbopack.ts';

it('returns true when a next script passes --turbopack', () => {
  expect(getHasTurbopack({ scripts: { dev: 'next dev --turbopack' } })).toBe(true);
});

it('returns true when next runs through a package runner', () => {
  expect(getHasTurbopack({ scripts: { dev: 'npx next dev --turbopack' } })).toBe(true);
});

it('returns false when a next script passes --webpack', () => {
  expect(getHasTurbopack({ scripts: { build: 'next build --webpack' } })).toBe(false);
});

it('returns undefined when a next script has no bundler flag', () => {
  expect(getHasTurbopack({ scripts: { dev: 'next dev' } })).toBeUndefined();
});

it('returns undefined when there are no scripts', () => {
  expect(getHasTurbopack({})).toBeUndefined();
});

it('does not treat next-prefixed package binaries as next scripts', () => {
  expect(getHasTurbopack({ scripts: { postbuild: 'next-sitemap --turbopack' } })).toBeUndefined();
});

it('does not treat next-suffixed binaries or next.* file paths as next scripts', () => {
  expect(
    getHasTurbopack({
      scripts: {
        check: 'lint-next --turbopack',
        config: 'node next.config.check.mjs --turbopack',
      },
    })
  ).toBeUndefined();
});

it('does not treat next as an argument to another command as a next script', () => {
  expect(getHasTurbopack({ scripts: { shout: 'echo next --turbopack' } })).toBeUndefined();
});

it('does not treat next without a dev/build subcommand as a next script', () => {
  expect(getHasTurbopack({ scripts: { start: 'next start --turbopack' } })).toBeUndefined();
});
