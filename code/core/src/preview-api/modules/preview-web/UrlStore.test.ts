import { describe, expect, it, vi } from 'vitest';

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

  describe('setSelection', () => {
    it('writes the path the preview was loaded from, not one a story changed', () => {
      document.location.pathname = '/iframe.html';
      document.location.search = '';
      document.location.hash = '';
      const store = new UrlStore();
      document.location.pathname = '/other/path';

      store.setSelection({ storyId: 'story--id', viewMode: 'story' });

      const url = '/iframe.html?id=story--id&viewMode=story';
      expect(history.replaceState).toHaveBeenLastCalledWith({}, '', url);
      expect(store.url).toBe(url);
    });
  });

  describe('setQueryParams', () => {
    it('keeps the params in the URL of the selected story', () => {
      document.location.pathname = '/iframe.html';
      document.location.search = '';
      document.location.hash = '';
      const store = new UrlStore();
      store.setSelection({ storyId: 'story--id', viewMode: 'story' });
      document.location.search = '?id=story--id&viewMode=story';

      store.setQueryParams({ args: 'a:1' });

      const url = '/iframe.html?id=story--id&viewMode=story&args=a%3A1';
      expect(history.replaceState).toHaveBeenLastCalledWith({}, '', url);
      expect(store.url).toBe(url);
    });
  });

  describe('lendLocation', () => {
    const lendingStore = () => {
      Object.assign(document.location, { pathname: '/iframe.html', search: '', hash: '#sb' });
      const store = new UrlStore();
      store.setSelection({ storyId: 'page--a', viewMode: 'story' });
      Object.assign(document.location, { search: '?id=page--a&viewMode=story' });
      store.lendLocation();
      vi.mocked(history.replaceState).mockClear();
      // The story moves `location` to a page of its own.
      Object.assign(document.location, { pathname: '/notes', search: '?q=page', hash: '#page' });
      return store;
    };

    it('keeps a selection and query params in the store without writing them', () => {
      const store = lendingStore();

      store.setQueryParams({ args: 'a:1' });
      store.setSelection({ storyId: 'page--b', viewMode: 'story' });
      store.setQueryParams({ globals: 'g:1' });

      expect(history.replaceState).not.toHaveBeenCalled();
      expect(store.url).toBe('/iframe.html?id=page--b&viewMode=story&args=a%3A1&globals=g%3A1#sb');
    });

    it('writes the URL of the selection once on reclaim, sets the title, and writes directly again', () => {
      const store = lendingStore();
      store.setSelection({ storyId: 'page--b', viewMode: 'story' });
      store.setQueryParams({ args: 'a:1' });

      store.reclaimLocation();

      const url = '/iframe.html?id=page--b&viewMode=story&args=a%3A1#sb';
      expect(history.replaceState).toHaveBeenCalledOnce();
      expect(history.replaceState).toHaveBeenCalledWith({}, '', url);
      expect(document.title).toBe('page--b');

      Object.assign(document.location, {
        pathname: '/iframe.html',
        search: '?id=page--b&viewMode=story&args=a%3A1',
        hash: '#sb',
      });
      store.setQueryParams({ args: 'a:2' });

      expect(history.replaceState).toHaveBeenLastCalledWith(
        {},
        '',
        '/iframe.html?id=page--b&viewMode=story&args=a%3A2#sb'
      );
    });
  });

  describe('reclaimLocation', () => {
    it('returns to the URL of the selected story when a story moved `location`', () => {
      Object.assign(document.location, { pathname: '/iframe.html', search: '', hash: '' });
      const store = new UrlStore();
      store.setSelection({ storyId: 'story--b', viewMode: 'story' });
      vi.mocked(history.replaceState).mockClear();
      Object.assign(document.location, { pathname: '/app/a', search: '', hash: '' });

      store.reclaimLocation();

      expect(history.replaceState).toHaveBeenCalledOnce();
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        '/iframe.html?id=story--b&viewMode=story'
      );
    });

    it('leaves the URL alone when the document is at the URL of the selected story', () => {
      Object.assign(document.location, { pathname: '/iframe.html', search: '', hash: '' });
      const store = new UrlStore();
      store.setSelection({ storyId: 'story--b', viewMode: 'story' });
      vi.mocked(history.replaceState).mockClear();
      Object.assign(document.location, { search: '?id=story--b&viewMode=story' });

      store.reclaimLocation();

      expect(history.replaceState).not.toHaveBeenCalled();
      expect(document.title).toBe('story--b');
    });

    it('leaves the URL alone when the browser encoded the same query differently', () => {
      Object.assign(document.location, { pathname: '/iframe.html', search: '', hash: '' });
      const store = new UrlStore();
      store.setSelection({ storyId: 'story--b', viewMode: 'story' });
      Object.assign(document.location, { search: '?id=story--b&viewMode=story' });
      store.setQueryParams({ args: "text:it's" });
      vi.mocked(history.replaceState).mockClear();
      Object.assign(document.location, {
        search: '?id=story--b&viewMode=story&args=text%3Ait%27s',
      });

      store.reclaimLocation();

      expect(store.url).toBe("/iframe.html?id=story--b&viewMode=story&args=text%3Ait's");
      expect(history.replaceState).not.toHaveBeenCalled();
    });
  });
});
