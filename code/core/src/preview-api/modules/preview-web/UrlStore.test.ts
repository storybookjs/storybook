import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getSelectionSpecifierFromPath, pathToId, setPath } from './UrlStore.ts';

const history = { replaceState: vi.fn() };

beforeEach(() => {
  vi.stubGlobal('history', history);
  vi.stubGlobal('document', { title: '' });
  vi.stubGlobal('location', { pathname: 'pathname', search: '', hash: '' });
});

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
      location.search = '?foo=bar&selectedStory=selStory&selectedKind=selKind';
      setPath({ storyId: 'story--id', viewMode: 'story' });
      expect(history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'pathname?foo=bar&id=story--id&viewMode=story'
      );
    });
    it('should ignore + keep hashes', () => {
      location.search = '?foo=bar&selectedStory=selStory&selectedKind=selKind';
      location.hash = '#foobar';
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
      location.search = '';
      expect(getSelectionSpecifierFromPath()).toEqual(null);
    });
    it('should handle id queries', () => {
      location.search = '?id=story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle viewMode=story', () => {
      location.search = '?id=story--id&viewMode=story';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle viewMode=docs', () => {
      location.search = '?id=story--id&viewMode=docs';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'docs',
      });
    });
    it('should ignore unsupported viewModes', () => {
      location.search = '?id=about&viewMode=somethingelse';
      expect(getSelectionSpecifierFromPath()).toEqual(null);
    });
    it('should handle story paths', () => {
      location.search = '?path=/story/story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle docs paths', () => {
      location.search = '?path=/docs/story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'docs',
      });
    });
    it('should handle id queries with *', () => {
      location.search = '?id=*';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: '*',
        viewMode: 'story',
      });
    });
    it('should parse args', () => {
      location.search = '?id=story--id&args=obj.key:val';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
        args: { obj: { key: 'val' } },
      });
    });
    it('should handle singleStory param', () => {
      location.search = '?id=abc&singleStory=true';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'abc',
        viewMode: 'story',
      });
    });
  });
});
