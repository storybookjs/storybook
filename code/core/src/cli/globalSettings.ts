import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { dedent } from 'ts-dedent';
import { z } from 'zod';

import {
  getLegacyStorybookConfigDir,
  getStorybookConfigDir,
} from '../common/utils/storybook-config-dir.ts';
import { invariant } from '../common/utils/utils.ts';

const SETTINGS_FILE = 'settings.json';

/** Resolved on each call so `XDG_CONFIG_HOME` can change at runtime (and in tests). */
const getDefaultSettingsPath = () => join(getStorybookConfigDir(), SETTINGS_FILE);

const VERSION = 1;

const statusValue = z
  .strictObject({
    status: z.enum(['open', 'accepted', 'done', 'skipped']).optional(),
    mutedAt: z.number().optional(),
  })
  .optional();

const userSettingSchema = z.object({
  version: z.number(),
  // NOTE: every key (and subkey) below must be optional, for forwards compatibility reasons
  // (we can remove keys once they are deprecated)
  userSince: z.number().optional(),
  init: z.object({ skipOnboarding: z.boolean().optional() }).optional(),
  checklist: z
    .object({
      items: z
        .object({
          accessibilityTests: statusValue,
          aiSetup: statusValue,
          autodocs: statusValue,
          ciTests: statusValue,
          controls: statusValue,
          coverage: statusValue,
          guidedTour: statusValue,
          installA11y: statusValue,
          installChromatic: statusValue,
          installDocs: statusValue,
          installVitest: statusValue,
          mdxDocs: statusValue,
          moreComponents: statusValue,
          moreStories: statusValue,
          onboardingSurvey: statusValue,
          organizeStories: statusValue,
          publishStorybook: statusValue,
          shareStorybook: statusValue,
          renderComponent: statusValue,
          runTests: statusValue,
          viewports: statusValue,
          visualTests: statusValue,
          whatsNewStorybook10: statusValue,
          writeInteractions: statusValue,
        })
        .optional(),
      widget: z.object({ disable: z.boolean().optional() }).optional(),
    })
    .optional(),
});

/**
 * Move an existing `~/.storybook/settings.json` to the XDG location the first time Storybook runs
 * after the switch, so users who set `XDG_CONFIG_HOME` don't silently lose their settings.
 */
async function migrateLegacySettings(filePath: string) {
  const legacyPath = join(getLegacyStorybookConfigDir(), SETTINGS_FILE);

  if (filePath === legacyPath) {
    return;
  }

  try {
    await fs.access(filePath);
    return; // already migrated
  } catch {
    // fall through
  }

  let legacyContent: string;
  try {
    legacyContent = await fs.readFile(legacyPath, 'utf8');
  } catch {
    return; // nothing to migrate
  }

  try {
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, legacyContent);
    console.log(`Moved Storybook settings from ${legacyPath} to ${filePath}`);
  } catch {
    // Copy failed, for example when the new location is not writable. globalSettings() below then
    // finds no file at the new path and starts from defaults. The legacy file is left untouched.
  }
}

let settings: Settings | undefined;
export async function globalSettings(filePath = getDefaultSettingsPath()) {
  if (settings) {
    return settings;
  }

  await migrateLegacySettings(filePath);

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
    invariant(this.filePath, 'No file path to save settings to');
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
