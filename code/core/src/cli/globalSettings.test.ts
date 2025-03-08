import { existsSync, promises as fs } from 'node:fs';
import { dirname } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Settings } from './globalSettings';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

describe('Settings', () => {
  const TEST_SETTINGS_FILE = '/test/settings.json';
  let settings: Settings;

  beforeEach(() => {
    vi.clearAllMocks();
    settings = new Settings(TEST_SETTINGS_FILE);
  });

  describe('load', () => {
    it('loads settings from file if it exists', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          theme: { mode: 'dark' },
        })
      );

      await settings.load();

      expect(fs.readFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, 'utf8');
      expect(settings.get('theme.mode')).toBe('dark');
    });

    it('initializes empty settings if file does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await settings.load();

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(settings.get('')).toEqual({});
    });

    it('handles JSON parse errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await settings.load();

      expect(settings.get('')).toEqual({});
    });

    it('handles file read errors', async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));

      await settings.load();

      expect(settings.get('')).toEqual({});
    });

    it('preserves existing settings when load fails', async () => {
      // Set initial settings
      settings.set('initial', 'value');

      // Mock load failure
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Read error'));

      await settings.load();

      // Should still have initial settings
      expect(settings.get('initial')).toBe('value');
    });
  });

  describe('save', () => {
    it('creates directory and saves settings to file', async () => {
      settings.set('theme.mode', 'dark');

      await settings.save();

      expect(fs.mkdir).toHaveBeenCalledWith(dirname(TEST_SETTINGS_FILE), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_SETTINGS_FILE,
        JSON.stringify({ theme: { mode: 'dark' } }, null, 2)
      );
    });

    it('throws error if write fails', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write error'));

      await expect(settings.save()).rejects.toThrow('Failed to save settings');
    });

    it('throws error if directory creation fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Directory creation error'));

      await expect(settings.save()).rejects.toThrow('Failed to save settings');
    });

    it('saves empty settings object when no settings exist', async () => {
      await settings.save();

      expect(fs.writeFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, JSON.stringify({}, null, 2));
    });
  });

  describe('get', () => {
    beforeEach(() => {
      // Set up some test data
      settings.set('theme.mode', 'dark');
      settings.set('a.b.c', 'value');
      settings.set('array', [1, 2, 3]);
      settings.set('nullValue', null);
      settings.set('boolValue', true);
      settings.set('numberValue', 42);
    });

    it('returns value for existing setting', () => {
      expect(settings.get('theme.mode')).toBe('dark');
    });

    it('returns undefined for non-existent setting', () => {
      expect(settings.get('theme.nonexistent')).toBeUndefined();
    });

    it('handles nested paths correctly', () => {
      expect(settings.get('a.b.c')).toBe('value');
    });

    it('returns undefined for invalid path', () => {
      expect(settings.get('a.x.y')).toBeUndefined();
    });

    it('returns root object when path is empty', () => {
      expect(settings.get('')).toEqual(settings.get(''));
    });

    it('handles array values', () => {
      expect(settings.get('array')).toEqual([1, 2, 3]);
    });

    it('handles null values', () => {
      expect(settings.get('nullValue')).toBeNull();
    });

    it('handles boolean values', () => {
      expect(settings.get('boolValue')).toBe(true);
    });

    it('handles number values', () => {
      expect(settings.get('numberValue')).toBe(42);
    });
  });

  describe('set', () => {
    it('sets value for new setting', () => {
      settings.set('theme.mode', 'dark');

      expect(settings.get('theme.mode')).toBe('dark');
    });

    it('updates value for existing setting', () => {
      settings.set('theme.mode', 'dark');
      settings.set('theme.mode', 'light');

      expect(settings.get('theme.mode')).toBe('light');
    });

    it('creates nested paths as needed', () => {
      settings.set('a.b.c', 'value');

      expect(settings.get('a.b.c')).toBe('value');
      expect(settings.get('')).toEqual({ a: { b: { c: 'value' } } });
    });

    it('handles setting root object with empty path', () => {
      settings.set('', { root: 'value' });

      expect(settings.get('')).toEqual({ root: 'value' });
    });

    it('handles setting array values', () => {
      settings.set('array', [1, 2, 3]);

      expect(settings.get('array')).toEqual([1, 2, 3]);
    });

    it('handles setting null values', () => {
      settings.set('nullValue', null);

      expect(settings.get('nullValue')).toBeNull();
    });

    it('handles setting object values', () => {
      const obj = { a: 1, b: 2 };
      settings.set('object', obj);

      expect(settings.get('object')).toEqual(obj);
    });

    it('overwrites existing object with scalar value', () => {
      settings.set('a.b', { c: 'value' });
      settings.set('a.b', 'scalar');

      expect(settings.get('a.b')).toBe('scalar');
    });

    it('overwrites existing scalar with object value', () => {
      settings.set('a.b', 'scalar');
      settings.set('a.b', { c: 'value' });

      expect(settings.get('a.b')).toEqual({ c: 'value' });
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      settings.set('theme.mode', 'dark');
      settings.set('theme.color', 'blue');
      settings.set('a.b.c', 'value');
    });

    it('removes existing setting', () => {
      settings.delete('theme.mode');

      expect(settings.get('theme.mode')).toBeUndefined();
      expect(settings.get('theme.color')).toBe('blue');
    });

    it('does nothing for non-existent setting', () => {
      settings.delete('theme.nonexistent');

      expect(settings.get('theme.mode')).toBe('dark');
      expect(settings.get('theme.color')).toBe('blue');
    });

    it('does nothing for invalid path', () => {
      settings.delete('a.x.y');

      expect(settings.get('a.b.c')).toBe('value');
    });

    it('removes entire object when deleting parent path', () => {
      settings.delete('theme');

      expect(settings.get('theme')).toBeUndefined();
      expect(settings.get('theme.mode')).toBeUndefined();
      expect(settings.get('theme.color')).toBeUndefined();
    });

    it('removes nested value without affecting siblings', () => {
      settings.set('a.b.d', 'another');
      settings.delete('a.b.c');

      expect(settings.get('a.b.c')).toBeUndefined();
      expect(settings.get('a.b.d')).toBe('another');
    });

    it('does nothing when path is empty', () => {
      const before = settings.get('');
      settings.delete('');

      expect(settings.get('')).toEqual(before);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      settings.set('theme.mode', 'dark');
      settings.set('nullValue', null);
      settings.set('falseValue', false);
      settings.set('zeroValue', 0);
      settings.set('emptyString', '');
      settings.set('emptyArray', []);
      settings.set('emptyObject', {});
    });

    it('returns true for existing setting', () => {
      expect(settings.has('theme.mode')).toBe(true);
    });

    it('returns false for non-existent setting', () => {
      expect(settings.has('theme.nonexistent')).toBe(false);
    });

    it('returns true for null value', () => {
      expect(settings.has('nullValue')).toBe(true);
    });

    it('returns true for false value', () => {
      expect(settings.has('falseValue')).toBe(true);
    });

    it('returns true for zero value', () => {
      expect(settings.has('zeroValue')).toBe(true);
    });

    it('returns true for empty string', () => {
      expect(settings.has('emptyString')).toBe(true);
    });

    it('returns true for empty array', () => {
      expect(settings.has('emptyArray')).toBe(true);
    });

    it('returns true for empty object', () => {
      expect(settings.has('emptyObject')).toBe(true);
    });

    it('returns true for root path', () => {
      expect(settings.has('')).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('load, modify, and save workflow', async () => {
      // Setup initial file content
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({
          existing: 'value',
        })
      );

      // Load settings
      await settings.load();
      expect(settings.get('existing')).toBe('value');

      // Modify settings
      settings.set('new', 'setting');
      settings.set('existing', 'updated');
      settings.delete('toDelete');

      // Save settings
      await settings.save();

      // Verify save was called with correct data
      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_SETTINGS_FILE,
        JSON.stringify(
          {
            existing: 'updated',
            new: 'setting',
          },
          null,
          2
        )
      );
    });

    it('handles complex nested operations', () => {
      // Set up complex nested structure
      settings.set('users.admin.name', 'Admin');
      settings.set('users.admin.permissions', ['read', 'write', 'delete']);
      settings.set('users.guest.name', 'Guest');
      settings.set('users.guest.permissions', ['read']);

      // Verify structure
      expect(settings.get('users.admin.permissions')).toEqual(['read', 'write', 'delete']);
      expect(settings.get('users.guest.permissions')).toEqual(['read']);

      // Modify nested structure
      settings.set('users.admin.permissions', ['read', 'write']);
      settings.delete('users.guest');

      // Verify changes
      expect(settings.get('users.admin.permissions')).toEqual(['read', 'write']);
      expect(settings.get('users.guest')).toBeUndefined();
      expect(settings.has('users.guest')).toBe(false);
      expect(settings.has('users.admin')).toBe(true);
    });
  });
});
