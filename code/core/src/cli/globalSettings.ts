import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { SavingGlobalSettingsFileError } from '../server-errors';

const DEFAULT_SETTINGS_PATH = join(homedir(), '.storybook', 'settings.json');

const VERSION = 1;

let settings: Settings;
export async function globalSettings() {
  settings = settings || new Settings();

  await settings.ensure();

  return settings;
}

// TODO replace this with zod
export interface UserSettings extends Record<string, any> {
  version: number;
  // Every field apart from verson *must* be nullable as we need to be forward-compatible.
  userSince?: string;
}

/**
 * A class for reading and writing settings from a JSON file. Supports nested settings with dot
 * notation.
 */
export class Settings {
  private filePath: string;

  private value?: UserSettings;

  /**
   * Create a new Settings instance
   *
   * @param filePath Path to the JSON settings file
   */
  constructor(filePath: string = DEFAULT_SETTINGS_PATH) {
    this.filePath = filePath;
  }

  /** Load settings from the file */
  async load(): Promise<void> {
    const content = await fs.readFile(this.filePath, 'utf8');
    this.value = JSON.parse(content);
  }

  /** Save settings to the file */
  async save(): Promise<void> {
    try {
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.value, null, 2));
    } catch (err) {
      throw new SavingGlobalSettingsFileError({
        filePath: this.filePath,
        error: err,
      });
    }
  }

  /* Ensure settings file exists and is loaded */
  async ensure() {
    if (this.value) {
      return;
    }

    try {
      await this.load();
    } catch (err: any) {
      // Settings file does not yet exist.
      if (err.code === 'ENOENT') {
        // TODO - log here?
      }

      // Error parsing existing settings file
      // TODO  - log here?

      // The existing settings file has a problem so we must overwrite it
      this.value = { version: VERSION, userSince: new Date().toString() };
      await this.save();
    }
  }

  /**
   * Get a setting value by path
   *
   * @param path Dot-notation path to the setting
   * @returns The setting value or undefined if not found
   */
  get(path: string): any {
    if (!this.value) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error('Cannot call .get() until user settings are loaded');
    }

    return path.split('.').reduce((obj, key) => obj?.[key], this.value);
  }

  /**
   * Set a setting value by path
   *
   * @param path Dot-notation path to the setting
   * @param value Value to set
   */
  set(path: string, value: any): void {
    if (!this.value) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error('Cannot call .set() until user settings are loaded');
    }

    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((obj, key) => {
      if (!(key in obj)) {
        obj[key] = {};
      }
      return obj[key];
    }, this.value);
    target[lastKey] = value;
  }

  /**
   * Delete a setting by path
   *
   * @param path Dot-notation path to the setting
   */
  delete(path: string): void {
    if (!this.value) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error('Cannot call .delete() until user settings are loaded');
    }

    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((obj, key) => obj?.[key], this.value);
    if (target) {
      delete target[lastKey];
    }
  }

  /**
   * Check if a setting exists
   *
   * @param path Dot-notation path to the setting
   * @returns True if the settings has an undefined value
   */
  has(path: string): boolean {
    return this.get(path) !== undefined;
  }
}
