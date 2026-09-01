import { describe, expect, it } from 'vitest';

import { createPathFilter } from './path-filter.ts';

const ROOT = '/home/dev/storybook/code';

/** Filters are always built against a root; most tests do not care which. */
function filter(include: string[], exclude: string[] = [], projectDir = ROOT) {
  return createPathFilter(include, exclude, projectDir);
}

describe('createPathFilter', () => {
  it('counts everything when given no globs', () => {
    const isCounted = filter([]);
    expect(isCounted('src/App.tsx')).toBe(true);
    expect(isCounted('anything/at/all.tsx')).toBe(true);
  });

  it('restricts to the include globs once any is given', () => {
    const isCounted = filter(['src/**']);
    expect(isCounted('src/App.tsx')).toBe(true);
    expect(isCounted('src/deep/Nested.tsx')).toBe(true);
    expect(isCounted('other/Thing.tsx')).toBe(false);
  });

  it('drops what an exclude glob matches', () => {
    const isCounted = filter([], ['core/src/components/**']);
    expect(isCounted('core/src/components/Button/Button.tsx')).toBe(false);
    expect(isCounted('core/src/manager/App.tsx')).toBe(true);
  });

  it('lets an exclude veto an include', () => {
    const isCounted = filter(['src/**'], ['src/debug/**']);
    expect(isCounted('src/App.tsx')).toBe(true);
    expect(isCounted('src/debug/Panel.tsx')).toBe(false);
    expect(isCounted('other/Thing.tsx')).toBe(false);
  });

  it('stops a single * at a path separator, where ** crosses it', () => {
    expect(filter(['src/*'])('src/App.tsx')).toBe(true);
    expect(filter(['src/*'])('src/deep/App.tsx')).toBe(false);
    expect(filter(['src/**'])('src/deep/App.tsx')).toBe(true);
  });

  it('lets a leading **/ match at the root as well as nested', () => {
    const isCounted = filter(['**/*.stories.tsx']);
    expect(isCounted('Button.stories.tsx')).toBe(true);
    expect(isCounted('src/deep/Button.stories.tsx')).toBe(true);
    expect(isCounted('src/Button.tsx')).toBe(false);
  });

  it('anchors both ends, so a glob is not a substring search', () => {
    const isCounted = filter(['src/App.tsx']);
    expect(isCounted('src/App.tsx')).toBe(true);
    expect(isCounted('vendor/src/App.tsx')).toBe(false);
    expect(isCounted('src/App.tsx.bak')).toBe(false);
  });

  it('holds a directory glob to a boundary rather than a prefix', () => {
    const isCounted = filter([], ['packages/ui/**']);
    expect(isCounted('packages/ui/New.tsx')).toBe(false);
    expect(isCounted('packages/ui-legacy/Old.tsx')).toBe(true);
  });

  // What the dependency buys over the hand-rolled matcher it replaced.
  describe('full glob syntax', () => {
    it('supports brace expansion', () => {
      const isCounted = filter(['src/**/*.{tsx,jsx}']);
      expect(isCounted('src/a/App.tsx')).toBe(true);
      expect(isCounted('src/a/App.jsx')).toBe(true);
      expect(isCounted('src/a/App.ts')).toBe(false);
    });

    it('supports extglobs and character classes', () => {
      expect(filter(['src/!(debug)/**'])('src/main/App.tsx')).toBe(true);
      expect(filter(['src/!(debug)/**'])('src/debug/App.tsx')).toBe(false);
      expect(filter(['src/[A-Z]*.tsx'])('src/App.tsx')).toBe(true);
      expect(filter(['src/[A-Z]*.tsx'])('src/app.tsx')).toBe(false);
    });

    // Nothing strips a leading ! anymore, so this stays a valid pattern in
    // both lists.
    it('keeps a leading !(...) extglob intact', () => {
      expect(filter(['!(src)/**'])('other/Thing.tsx')).toBe(true);
      expect(filter(['!(src)/**'])('src/App.tsx')).toBe(false);
      expect(filter([], ['!(src)/**'])('src/App.tsx')).toBe(true);
      expect(filter([], ['!(src)/**'])('other/Thing.tsx')).toBe(false);
    });

    it('matches ? as exactly one character, separators excluded', () => {
      const isCounted = filter(['src/?.tsx']);
      expect(isCounted('src/A.tsx')).toBe(true);
      expect(isCounted('src/AB.tsx')).toBe(false);
    });

    // Off by default in picomatch, which would quietly skip a dot directory.
    it('matches dot directories', () => {
      expect(filter([], ['.storybook/**'])('.storybook/preview.tsx')).toBe(false);
      expect(filter(['**/*.tsx'])('.config/thing.tsx')).toBe(true);
    });
  });

  // Both spellings of the same directory: the one you would paste from a
  // shell, and the one the report prints.
  describe('absolute globs', () => {
    it('rebases an absolute glob onto the project root', () => {
      const isCounted = filter([], [`${ROOT}/core/src/components/**`]);
      expect(isCounted('core/src/components/Button/Button.tsx')).toBe(false);
      expect(isCounted('core/src/manager/App.tsx')).toBe(true);
    });

    it('gives the same answer as the relative spelling', () => {
      const paths = ['core/src/components/a.tsx', 'core/src/manager/b.tsx', 'addons/docs/c.tsx'];
      const relative = filter([], ['core/src/components/**']);
      const absolute = filter([], [`${ROOT}/core/src/components/**`]);
      for (const path of paths) expect(absolute(path), path).toBe(relative(path));
    });

    it('mixes absolute and relative globs across the lists', () => {
      const isCounted = filter([`${ROOT}/src/**`], ['src/debug/**']);
      expect(isCounted('src/App.tsx')).toBe(true);
      expect(isCounted('src/debug/Panel.tsx')).toBe(false);
      expect(isCounted('other/Thing.tsx')).toBe(false);
    });

    it('resolves against a relative projectDir too', () => {
      const isCounted = createPathFilter([`${process.cwd()}/src/**`], [], '.');
      expect(isCounted('src/App.tsx')).toBe(true);
      expect(isCounted('other/App.tsx')).toBe(false);
    });

    it('normalises a redundant absolute path', () => {
      const isCounted = filter([], [`${ROOT}/core/./src/../src/components/**`]);
      expect(isCounted('core/src/components/a.tsx')).toBe(false);
      expect(isCounted('core/src/manager/a.tsx')).toBe(true);
    });

    // Silently matching nothing is the failure mode worth being loud about:
    // it reads as "there was nothing to exclude" rather than "wrong path".
    it('throws on an absolute glob outside the analyzed tree', () => {
      expect(() => filter(['/somewhere/else/**'])).toThrow(/outside the analyzed tree/);
      expect(() => filter([], ['/somewhere/else/**'])).toThrow(/outside the analyzed tree/);
      expect(() => filter([], [`${ROOT}/../sibling/**`])).toThrow(/outside the analyzed tree/);
    });

    it('throws on an absolute glob that is the tree itself', () => {
      expect(() => filter([], [`${ROOT}`])).toThrow(/outside the analyzed tree/);
    });
  });
});
