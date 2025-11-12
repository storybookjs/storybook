import { beforeEach, describe, expect, it, vi } from 'vitest';

import { isMacLike } from './platform';
import type { KeyboardEventLike } from './shortcut';
import {
  controlOrMetaKey,
  controlOrMetaSymbol,
  eventMatchesShortcut,
  eventToShortcut,
  isShortcutTaken,
  keyToSymbol,
  optionOrAltSymbol,
  shortcutMatchesShortcut,
  shortcutToHumanString,
} from './shortcut';

// Mock the functions directly
vi.mock('./platform', async () => {
  return {
    isMacLike: vi.fn(),
  };
});

describe('shortcut', () => {
  beforeEach(() => {
    vi.mocked(isMacLike).mockReset();
  });

  describe('platform detection', () => {
    it('isMacLike can be mocked', () => {
      vi.mocked(isMacLike).mockReturnValue(true);
      expect(isMacLike()).toBe(true);

      vi.mocked(isMacLike).mockReturnValue(false);
      expect(isMacLike()).toBe(false);
    });

    it('controlOrMetaSymbol returns correct symbol based on platform', () => {
      // For Mac
      vi.mocked(isMacLike).mockReturnValue(true);
      expect(controlOrMetaSymbol()).toBe('⌘');

      // For non-Mac
      vi.mocked(isMacLike).mockReturnValue(false);
      expect(controlOrMetaSymbol()).toBe('ctrl');
    });

    it('controlOrMetaKey returns correct key based on platform', () => {
      // For Mac
      vi.mocked(isMacLike).mockReturnValue(true);
      expect(controlOrMetaKey()).toBe('meta');

      // For non-Mac
      vi.mocked(isMacLike).mockReturnValue(false);
      expect(controlOrMetaKey()).toBe('control');
    });

    it('optionOrAltSymbol returns correct symbol based on platform', () => {
      // For Mac
      vi.mocked(isMacLike).mockReturnValue(true);
      expect(optionOrAltSymbol()).toBe('⌥');

      // For non-Mac
      vi.mocked(isMacLike).mockReturnValue(false);
      expect(optionOrAltSymbol()).toBe('alt');
    });
  });

  describe('isShortcutTaken', () => {
    it('returns true for identical shortcuts', () => {
      expect(isShortcutTaken(['alt', 'K'], ['alt', 'K'])).toBe(true);
    });

    it('returns false for different shortcuts', () => {
      expect(isShortcutTaken(['alt', 'K'], ['alt', 'J'])).toBe(false);
      expect(isShortcutTaken(['alt', 'K'], ['meta', 'K'])).toBe(false);
      expect(isShortcutTaken(['alt', 'K'], ['alt', 'K', 'L'])).toBe(false);
    });
  });

  describe('eventToShortcut', () => {
    it('returns null for meta-only key events and tab', () => {
      const metaOnlyKeys = ['Meta', 'Alt', 'Control', 'Shift', 'Tab'];

      metaOnlyKeys.forEach((key) => {
        const event = { key } as KeyboardEventLike;
        expect(eventToShortcut(event)).toBe(null);
      });
    });

    it('processes modifier keys correctly', () => {
      const event = {
        key: 'K',
        altKey: true,
        ctrlKey: true,
        metaKey: true,
        shiftKey: true,
      } as KeyboardEventLike;

      expect(eventToShortcut(event)).toEqual(['alt', 'control', 'meta', 'shift', 'K']);
    });

    it('handles single letter keys correctly', () => {
      const event = {
        key: 'k',
      } as KeyboardEventLike;

      expect(eventToShortcut(event)).toEqual(['K']);
    });

    it('handles space key correctly', () => {
      const event = {
        key: ' ',
      } as KeyboardEventLike;

      expect(eventToShortcut(event)).toEqual(['space']);
    });

    it('handles escape key correctly', () => {
      const event = {
        key: 'Escape',
      } as KeyboardEventLike;

      expect(eventToShortcut(event)).toEqual(['escape']);
    });

    it('handles arrow keys correctly', () => {
      const arrowKeys = ['ArrowRight', 'ArrowDown', 'ArrowUp', 'ArrowLeft'];

      arrowKeys.forEach((key) => {
        const event = { key } as KeyboardEventLike;
        expect(eventToShortcut(event)).toEqual([key]);
      });
    });

    it('supports different key/code combinations', () => {
      const event = {
        key: 'a',
        code: 'KeyA',
      } as KeyboardEventLike;

      expect(eventToShortcut(event)).toEqual(['A']);

      // When event.code produces a different value than event.key (e.g., with alt key on Mac)
      const altEvent = {
        key: 'å', // A special character
        code: 'KeyA',
      } as KeyboardEventLike;

      expect(eventToShortcut(altEvent)).toEqual([['Å', 'A']]);
    });
  });

  describe('shortcutMatchesShortcut', () => {
    it('returns false when either shortcut is null', () => {
      expect(shortcutMatchesShortcut(null as any, ['alt', 'K'])).toBe(false);
      expect(shortcutMatchesShortcut(['alt', 'K'], null as any)).toBe(false);
    });

    it('handles shift/ shortcuts correctly', () => {
      expect(shortcutMatchesShortcut(['shift', '/'], ['/'])).toBe(true);
    });

    it('compares shortcuts of different lengths correctly', () => {
      expect(shortcutMatchesShortcut(['alt', 'K'], ['alt', 'K', 'L'])).toBe(false);
      expect(shortcutMatchesShortcut(['alt', 'K', 'L'], ['alt', 'K'])).toBe(false);
    });

    it('compares shortcuts with same length correctly', () => {
      expect(shortcutMatchesShortcut(['alt', 'K'], ['alt', 'K'])).toBe(true);
      expect(shortcutMatchesShortcut(['alt', 'K'], ['alt', 'J'])).toBe(false);
      expect(shortcutMatchesShortcut(['alt', ['K', 'L']], ['alt', 'K'])).toBe(true);
      expect(shortcutMatchesShortcut(['alt', ['K', 'L']], ['alt', 'L'])).toBe(true);
      expect(shortcutMatchesShortcut(['alt', ['K', 'L']], ['alt', 'M'])).toBe(false);
    });
  });

  describe('eventMatchesShortcut', () => {
    it('matches keyboard event to shortcut correctly', () => {
      const event = {
        key: 'K',
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
      } as KeyboardEventLike;

      expect(eventMatchesShortcut(event, ['alt', 'K'])).toBe(true);
      expect(eventMatchesShortcut(event, ['meta', 'K'])).toBe(false);
    });
  });

  describe('keyToSymbol', () => {
    it('converts modifier keys to symbols', () => {
      // For Mac
      vi.mocked(isMacLike).mockReturnValue(true);

      expect(keyToSymbol('alt')).toBe('⌥');
      expect(keyToSymbol('control')).toBe('⌃');
      expect(keyToSymbol('meta')).toBe('⌘');
      expect(keyToSymbol('shift')).toBe('⇧​');

      // For non-Mac
      vi.mocked(isMacLike).mockReturnValue(false);

      expect(keyToSymbol('alt')).toBe('alt');
    });

    it('converts special keys to symbols', () => {
      expect(keyToSymbol('Enter')).toBe('');
      expect(keyToSymbol('Backspace')).toBe('');
      expect(keyToSymbol('Esc')).toBe('');
      expect(keyToSymbol('escape')).toBe('');
      expect(keyToSymbol(' ')).toBe('SPACE');
      expect(keyToSymbol('ArrowUp')).toBe('↑');
      expect(keyToSymbol('ArrowDown')).toBe('↓');
      expect(keyToSymbol('ArrowLeft')).toBe('←');
      expect(keyToSymbol('ArrowRight')).toBe('→');
    });

    it('converts regular keys to uppercase', () => {
      expect(keyToSymbol('a')).toBe('A');
      expect(keyToSymbol('1')).toBe('1');
    });
  });

  describe('shortcutToHumanString', () => {
    it('converts shortcut to human-readable string', () => {
      // For Mac
      vi.mocked(isMacLike).mockReturnValue(true);

      expect(shortcutToHumanString(['alt', 'K'])).toBe('⌥ K');
      expect(shortcutToHumanString(['control', 'alt', 'shift', 'K'])).toBe('⌃ ⌥ ⇧​ K');
      expect(shortcutToHumanString(['meta', 'ArrowUp'])).toBe('⌘ ↑');

      // For non-Mac
      vi.mocked(isMacLike).mockReturnValue(false);

      expect(shortcutToHumanString(['alt', 'K'])).toBe('alt K');
    });
  });
});
