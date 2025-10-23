import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { dedent } from 'ts-dedent';
import { z } from 'zod';

const DEFAULT_SETTINGS_PATH = join(homedir(), '.storybook', 'settings.json');

const VERSION = 1;

const userSettingSchema = z.object({
  version: z.number(),
  // NOTE: every key (and subkey) below must be optional, for forwards compatibility reasons
  // (we can remove keys once they are deprecated)
  userSince: z.number().optional(),
  init: z.object({ skipOnboarding: z.boolean().optional() }).optional(),
  checklist: z
    .object({
      muted: z.union([z.boolean(), z.array(z.string())]).optional(),
      completed: z.array(z.string()),
      skipped: z.array(z.string()),
    })
    .optional(),
});

let settings: Settings | undefined;
export async function globalSettings(filePath = DEFAULT_SETTINGS_PATH) {
  if (settings) {
    return settings;
  }

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const settingsValue = userSettingSchema.parse(JSON.parse(content));
    settings = new Settings(filePath, settingsValue);
  } catch (err: any) {
    // We don't currently log the issue we have loading the setting file here, but if it doesn't
    // yet exist we'll get err.code = 'ENOENT'

    // There is no existing settings file or it has a problem;
    settings = new Settings(filePath, { version: VERSION, userSince: Date.now() });
    await settings.save();
  }

  return settings;
}

// For testing
export function _clearGlobalSettings() {
  settings = undefined;
}

/**
 * A class for reading and writing settings from a JSON file. Supports nested settings with dot
 * notation.
 */
export class Settings {
  private filePath: string;

  public value: z.infer<typeof userSettingSchema>;

  /**
   * Create a new Settings instance
   *
   * @param filePath Path to the JSON settings file
   * @param value Loaded value of settings
   */
  constructor(filePath: string, value: z.infer<typeof userSettingSchema>) {
    this.filePath = filePath;
    this.value = value;
  }

  /** Save settings to the file */
  async save(): Promise<void> {
    try {
      await fs.mkdir(dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(this.value, null, 2));
    } catch (err) {
      console.warn(dedent`
        Unable to save global settings file to ${this.filePath}
        ${err && `Reason: ${(err as Error).message ?? err}`}`);
    }
  }
}
