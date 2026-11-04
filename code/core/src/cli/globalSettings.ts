import fs from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { dedent } from 'ts-dedent';
import * as v from 'valibot';

import { migrateLegacySettings } from '../common/utils/migrate-legacy-settings.ts';
import { getStorybookConfigDir } from '../common/utils/storybook-config-dir.ts';
import { invariant } from '../common/utils/utils.ts';

const SETTINGS_FILE = 'settings.json';

const getDefaultSettingsPath = () => join(getStorybookConfigDir(), SETTINGS_FILE);

const VERSION = 1;

const statusValue = v.optional(
  v.strictObject({
    status: v.optional(v.picklist(['open', 'accepted', 'done', 'skipped'])),
    mutedAt: v.optional(v.number()),
  })
);

const userSettingSchema = v.object({
  version: v.number(),
  // NOTE: every key (and subkey) below must be optional, for forwards compatibility reasons
  // (we can remove keys once they are deprecated)
  userSince: v.optional(v.number()),
  init: v.optional(v.object({ skipOnboarding: v.optional(v.boolean()) })),
  checklist: v.optional(
    v.object({
      items: v.optional(
        v.object({
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
      ),
      widget: v.optional(v.object({ disable: v.optional(v.boolean()) })),
    })
  ),
});

type UserSettings = v.InferOutput<typeof userSettingSchema>;

let settings: Settings | undefined;
export async function globalSettings(filePath = getDefaultSettingsPath()) {
  if (settings) {
    return settings;
  }

  if (filePath === getDefaultSettingsPath()) {
    try {
      await migrateLegacySettings();
    } catch (err) {
      console.warn(dedent`
        Unable to migrate legacy global settings to ${filePath}
        Reason: ${(err as Error).message ?? err}`);
    }
  }

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const settingsValue = v.parse(userSettingSchema, JSON.parse(content));
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

  public value: UserSettings;

  /**
   * Create a new Settings instance
   *
   * @param filePath Path to the JSON settings file
   * @param value Loaded value of settings
   */
  constructor(filePath: string, value: UserSettings) {
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
