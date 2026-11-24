import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { UrlStore, getSelectionSpecifierFromPath, pathToId, setPath } from './UrlStore.ts';

const { history, document } = global;

vi.mock('@storybook/global', () => ({
  global: {
    history: { replaceState: vi.fn() },
    document: {
      location: {
        pathname: 'pathname',
        search: '',
      },
    },
  },
}));

describe('UrlStore', () => {
  describe('pathToId', () => {
    it('should parse valid ids', () => {
      expect(pathToId('/story/story--id')).toEqual('story--id');
    });
    it('should parse docs ids', () => {
      expect(pathToId('/docs/story--id')).toEqual('story--id');
    });
    it('should error on invalid ids', () => {
      [null, '', '/whatever/story/story--id'].forEach((path: any) => {
        expect(() => pathToId(path)).toThrow(/Invalid/);
      });
    });
  });

  describe('setPath', () => {
    it('should navigate to storyId', () => {
      setPath({ storyId: 'story--id', viewMode: 'story' });
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?id=story--id&viewMode=story'
      );
    });
    it('should replace legacy parameters but preserve others', () => {
      document.location.search = '?foo=bar&selectedStory=selStory&selectedKind=selKind';
      setPath({ storyId: 'story--id', viewMode: 'story' });
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?foo=bar&id=story--id&viewMode=story'
      );
    });
    it('should ignore + keep hashes', () => {
      document.location.search = '?foo=bar&selectedStory=selStory&selectedKind=selKind';
      document.location.hash = '#foobar';
      setPath({ storyId: 'story--id', viewMode: 'story' });
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?foo=bar&id=story--id&viewMode=story#foobar'
      );
    });
  });

  describe('getSelectionSpecifierFromPath', () => {
    it('should handle no search', () => {
      document.location.search = '';
      expect(getSelectionSpecifierFromPath()).toEqual(null);
    });
    it('should handle id queries', () => {
      document.location.search = '?id=story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle viewMode=story', () => {
      document.location.search = '?id=story--id&viewMode=story';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle viewMode=docs', () => {
      document.location.search = '?id=story--id&viewMode=docs';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'docs',
      });
    });
    it('should ignore unsupported viewModes', () => {
      document.location.search = '?id=about&viewMode=somethingelse';
      expect(getSelectionSpecifierFromPath()).toEqual(null);
    });
    it('should handle story paths', () => {
      document.location.search = '?path=/story/story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle docs paths', () => {
      document.location.search = '?path=/docs/story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'docs',
      });
    });
    it('should handle id queries with *', () => {
      document.location.search = '?id=*';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: '*',
        viewMode: 'story',
      });
    });
    it('should parse args', () => {
      document.location.search = '?id=story--id&args=obj.key:val';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
        args: { obj: { key: 'val' } },
      });
    });
    it('should handle singleStory param', () => {
      document.location.search = '?id=abc&singleStory=true';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'abc',
        viewMode: 'story',
      });
    });
  });

  describe('setQueryParams', () => {
    const replaceStateUrl = () => {
      const calls = vi.mocked(history.replaceState).mock.calls;
      return calls.at(-1)?.[2] as string;
    };

    beforeEach(() => {
      vi.clearAllMocks();
      document.location.search = '?id=story--id&viewMode=story';
    });

    afterEach(() => {
      document.location.search = '';
    });

    it('should merge the given params into the current URL', () => {
      new UrlStore().setQueryParams({ globals: 'theme:dark' });
      expect(replaceStateUrl()).toContain('id=story--id');
      expect(replaceStateUrl()).toContain('globals=theme%3Adark');
    });

    it('should remove a param that the manager cleared explicitly', () => {
      document.location.search = '?id=story--id&globals=theme:dark';
      new UrlStore().setQueryParams({ globals: null });

      // The manager sends `null` to clear a param. Merging it into the current URL would keep the
      // old value or produce an empty `globals=`, which the docs page reads back on remount and
      // shows as a stale global.
      expect(replaceStateUrl()).not.toContain('globals');
      expect(replaceStateUrl()).toContain('id=story--id');
    });

    it('should remove a param that is undefined', () => {
      document.location.search = '?id=story--id&globals=theme:dark';
      new UrlStore().setQueryParams({ globals: undefined });
      expect(replaceStateUrl()).not.toContain('globals');
    });

    it('should keep unrelated params while clearing others', () => {
      document.location.search = '?id=story--id&globals=theme:dark&args=foo:bar';
      new UrlStore().setQueryParams({ globals: null, viewMode: 'docs' });

      expect(replaceStateUrl()).not.toContain('globals');
      expect(replaceStateUrl()).toContain('args=foo%3Abar');
      expect(replaceStateUrl()).toContain('viewMode=docs');
    });
  });
});
