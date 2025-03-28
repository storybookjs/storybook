/* eslint-disable no-underscore-dangle */
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const DEFAULT_SETTINGS_PATH = join(homedir(), '.storybook', 'settings.json');

/**
 * A class for reading and writing settings from a JSON file. Supports nested settings with dot
 * notation.
 */
export class Settings {
  private filePath: string;

  _settings: Record<string, any>;

  /**
   * Create a new Settings instance
   *
   * @param filePath Path to the JSON settings file
   */
  constructor(filePath: string = DEFAULT_SETTINGS_PATH) {
    this.filePath = filePath;
    this._settings = {};
  }

  /** Load settings from the file */
  async load(): Promise<void> {
    try {
      if (existsSync(this.filePath)) {
        const content = await fs.readFile(this.filePath, 'utf8');
        this._settings = JSON.parse(content);
      }
    } catch (error) {
      // no-op
    }
  }

  async safeLoad(): Promise<void> {
    try {
      await this.load();
    } catch (error) {
      // no-op
    }
  }

  /** Save settings to the file */
  async save(): Promise<void> {
    try {
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this._settings, null, 2));
    } catch (error) {
      throw new Error(`Failed to save settings to ${this.filePath}: ${error}`);
    }
  }

  async safeSave(): Promise<void> {
    try {
      await this.save();
    } catch (error) {
      // no-op
    }
  }

  /**
   * Get a setting value by path
   *
   * @param path Dot-notation path to the setting
   * @returns The setting value or undefined if not found
   */
  get(path: string): any {
    if (path === '') {
      return this._settings;
    }
    return path.split('.').reduce((obj, key) => obj?.[key], this._settings);
  }

  /**
   * Set a setting value by path
   *
   * @param path Dot-notation path to the setting
   * @param value Value to set
   */
  set(path: string, value: any): void {
    if (path === '') {
      Object.assign(this._settings, value);
      return;
    }
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((obj, key) => {
      if (!(key in obj)) {
        obj[key] = {};
      }
      return obj[key];
    }, this._settings);
    target[lastKey] = value;
  }

  /**
   * Delete a setting by path
   *
   * @param path Dot-notation path to the setting
   */
  delete(path: string): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((obj, key) => obj?.[key], this._settings);
    if (target) {
      delete target[lastKey];
    }
  }

  /**
   * Check if a setting exists
   *
   * @param path Dot-notation path to the setting
   * @returns True if the setting exists
   */
  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  /**
   * Get the creation time of the settings file
   *
   * @returns The creation time as a Date object, or undefined if file doesn't exist
   */
  async getFileCreationDate(): Promise<Date | undefined> {
    try {
      if (!existsSync(this.filePath)) {
        return undefined;
      }
      const stats = await fs.stat(this.filePath);
      return stats.birthtime;
    } catch {
      return undefined;
    }
  }
}
