import { describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { getSelectionSpecifierFromPath, pathToId, setPath } from './UrlStore';

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
      document.location.search = 'foo=bar&selectedStory=selStory&selectedKind=selKind';
      setPath({ storyId: 'story--id', viewMode: 'story' });
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?foo=bar&id=story--id&viewMode=story'
      );
    });
    it('should ignore + keep hashes', () => {
      document.location.search = 'foo=bar&selectedStory=selStory&selectedKind=selKind';
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
});
