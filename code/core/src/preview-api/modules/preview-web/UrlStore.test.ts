import { describe, expect, it, vi } from 'vitest';

import { global } from '@storybook/global';

import { getSelectionSpecifierFromPath, pathToId, setPath } from './UrlStore.ts';

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
    it('should not include the invalid path value in the error message', () => {
      expect(() => pathToId('/whatever/main%0APhishing')).toThrow(
        "Invalid path, must start with '/story/'"
      );
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
    it('should handle id queries with *', () => {
      document.location.search = '?id=*';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: '*',
        viewMode: 'story',
      });
    });
    it('should handle simple id queries', () => {
      document.location.search = '?id=story-1';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story-1',
        viewMode: 'story',
      });
    });
    it('should handle path queries', () => {
      document.location.search = '?path=/story/story--id';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id',
        viewMode: 'story',
      });
    });
    it('should handle test id queries', () => {
      document.location.search = '?id=story--id:test-name';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id:test-name',
        viewMode: 'story',
      });
    });
    it.each([
      ['line feed', 'a%0Ab'],
      ['carriage return', 'a%0Db'],
      ['tab', 'a%09b'],
      ['html tag', '%3Cscript%3E'],
      ['empty test id part', 'story--id:'],
      ['empty id', ''],
      ['too many story id parts', 'story--id--extra'],
      ['trailing hyphen', 'story-'],
      ['leading hyphen', '-story'],
      ['uppercase letters', 'STORY--ID'],
      [
        'reported phishing payload',
        'main%27.%0APlease%20report%20it%20to%20www.MyWebSideErrors.com%0A%0APHISHING+TEXT%0D',
      ],
    ])('should ignore id queries with invalid story specifiers containing %s', (_, id) => {
      document.location.search = `?id=${id}`;
      expect(getSelectionSpecifierFromPath()).toEqual(null);
    });
    it('should handle test id queries with multiple parts', () => {
      document.location.search = '?id=story--id:test1:test2';
      expect(getSelectionSpecifierFromPath()).toEqual({
        storySpecifier: 'story--id:test1:test2',
        viewMode: 'story',
      });
    });
    it.each([
      ['line feed', '/story/a%0Ab'],
      ['carriage return', '/story/a%0Db'],
      ['tab', '/story/a%09b'],
      ['html tag', '/story/%3Cscript%3E'],
      [
        'reported phishing payload',
        '/story/main%27.%0APlease%20report%20it%20to%20www.MyWebSideErrors.com%0A%0APHISHING+TEXT%0D',
      ],
    ])('should ignore path queries with invalid story specifiers containing %s', (_, path) => {
      document.location.search = `?path=${path}`;
      expect(getSelectionSpecifierFromPath()).toEqual(null);
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
