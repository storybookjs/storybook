import fs from 'node:fs/promises';
import { dirname } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Settings } from './globalSettings';

vi.mock('node:fs');
vi.mock('node:fs/promises');

describe('Settings', () => {
  const TEST_SETTINGS_FILE = '/test/settings.json';
  let settings: Settings;

  const userSince = new Date().toString();
  const baseSettings = { version: 1, userSince };
  const baseSettingsJson = JSON.stringify(baseSettings, null, 2);

  beforeEach(() => {
    vi.resetAllMocks();
    settings = new Settings(TEST_SETTINGS_FILE);
  });

  describe('load', () => {
    it('loads settings from file if it exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

      await settings.load();

      expect(fs.readFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, 'utf8');
      expect(settings.get('userSince')).toBe(userSince);
    });

    it('errors if settings file does not exist', async () => {
      const error = new Error() as Error & { code: string };
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await expect(settings.load()).rejects.toThrow();
    });

    it('handles JSON parse errors', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('invalid json');

      await expect(settings.load()).rejects.toThrow();
    });
  });

  describe('ensure', () => {
    it('loads settings when called for the first time', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

      await settings.ensure();

      expect(settings.get('userSince')).toBe(userSince);
    });

    it('does nothing if settings are already loaded', async () => {
      await settings.ensure();
      expect(fs.readFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, 'utf8');

      vi.mocked(fs.readFile).mockClear();
      await settings.ensure();
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('does not save settings if they exist', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);

      await settings.ensure();

      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('saves settings and creates directory if they do not exist', async () => {
      const error = new Error() as Error & { code: string };
      error.code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      await settings.ensure();

      expect(fs.mkdir).toHaveBeenCalledWith(dirname(TEST_SETTINGS_FILE), { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledWith(TEST_SETTINGS_FILE, baseSettingsJson);
    });
  });

  describe('save', () => {
    it('overwrites existing settings', async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
      await settings.ensure();
      vi.mocked(fs.writeFile).mockClear();

      settings.set('theme.mode', 'dark');
      await settings.save();

      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_SETTINGS_FILE,
        JSON.stringify({ ...baseSettings, theme: { mode: 'dark' } }, null, 2)
      );
    });

    it('throws error if write fails', async () => {
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write error'));

      await expect(settings.save()).rejects.toThrow('Unable to save global settings');
    });

    it('throws error if directory creation fails', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Directory creation error'));

      await expect(settings.save()).rejects.toThrow('Unable to save global settings');
    });
  });

  describe('get', () => {
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
      await settings.ensure();

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
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
      await settings.ensure();
    });

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
      expect(settings.get('a')).toEqual({ b: { c: 'value' } });
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
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
      await settings.ensure();

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
  });

  describe('has', () => {
    beforeEach(async () => {
      vi.mocked(fs.readFile).mockResolvedValue(baseSettingsJson);
      await settings.ensure();

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
  });
});
