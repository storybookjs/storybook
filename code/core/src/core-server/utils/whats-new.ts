import fs from 'fs-extra';
import { logger } from '@storybook/core/node-logger';
import { telemetry } from '@storybook/core/telemetry';
import { findConfigFile } from '@storybook/core/common';
import type { CoreConfig, Options } from '@storybook/core/types';
import { printConfig, readConfig } from '@storybook/core/csf-tools';
import type { Channel } from '@storybook/core/channels';
import type { WhatsNewCache, WhatsNewData } from '@storybook/core/core-events';
import {
  REQUEST_WHATS_NEW_DATA,
  RESULT_WHATS_NEW_DATA,
  TELEMETRY_ERROR,
  SET_WHATS_NEW_CACHE,
  TOGGLE_WHATS_NEW_NOTIFICATIONS,
} from '@storybook/core/core-events';
import invariant from 'tiny-invariant';
import { sendTelemetryError } from '../withTelemetry';

export type OptionsWithRequiredCache = Exclude<Options, 'cache'> & Required<Pick<Options, 'cache'>>;

// Grabbed from the implementation: https://github.com/storybookjs/dx-functions/blob/main/netlify/functions/whats-new.ts
export type WhatsNewResponse = {
  title: string;
  url: string;
  blogUrl?: string;
  publishedAt: string;
  excerpt: string;
};

const WHATS_NEW_CACHE = 'whats-new-cache';
const WHATS_NEW_URL = 'https://storybook.js.org/whats-new/v1';

export function initializeWhatsNew(
  channel: Channel,
  options: OptionsWithRequiredCache,
  coreOptions: CoreConfig
) {
  channel.on(SET_WHATS_NEW_CACHE, async (data: WhatsNewCache) => {
    const cache: WhatsNewCache = await options.cache.get(WHATS_NEW_CACHE).catch((e) => {
      logger.verbose(e);
      return {};
    });
    await options.cache.set(WHATS_NEW_CACHE, { ...cache, ...data });
  });

  channel.on(REQUEST_WHATS_NEW_DATA, async () => {
    try {
      const post = (await fetch(WHATS_NEW_URL).then(async (response) => {
        if (response.ok) return response.json();
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw response;
      })) as WhatsNewResponse;

      const configFileName = findConfigFile('main', options.configDir);
      if (!configFileName) {
        throw new Error(`unable to find storybook main file in ${options.configDir}`);
      }
      const main = await readConfig(configFileName);
      const disableWhatsNewNotifications = main.getFieldValue([
        'core',
        'disableWhatsNewNotifications',
      ]);

      const cache: WhatsNewCache = (await options.cache.get(WHATS_NEW_CACHE)) ?? {};
      const data = {
        ...post,
        status: 'SUCCESS',
        postIsRead: post.url === cache.lastReadPost,
        showNotification: post.url !== cache.lastDismissedPost && post.url !== cache.lastReadPost,
        disableWhatsNewNotifications,
      } satisfies WhatsNewData;
      channel.emit(RESULT_WHATS_NEW_DATA, { data });
    } catch (e) {
      logger.verbose(e instanceof Error ? e.message : String(e));
      channel.emit(RESULT_WHATS_NEW_DATA, {
        data: { status: 'ERROR' } satisfies WhatsNewData,
      });
    }
  });

  channel.on(
    TOGGLE_WHATS_NEW_NOTIFICATIONS,
    async ({ disableWhatsNewNotifications }: { disableWhatsNewNotifications: boolean }) => {
      const isTelemetryEnabled = coreOptions.disableTelemetry !== true;
      try {
        const mainPath = findConfigFile('main', options.configDir);
        invariant(mainPath, `unable to find storybook main file in ${options.configDir}`);
        const main = await readConfig(mainPath);
        main.setFieldValue(['core', 'disableWhatsNewNotifications'], disableWhatsNewNotifications);
        await fs.writeFile(mainPath, printConfig(main).code);
        if (isTelemetryEnabled) {
          await telemetry('core-config', { disableWhatsNewNotifications });
        }
      } catch (error) {
        invariant(error instanceof Error);
        if (isTelemetryEnabled) {
          await sendTelemetryError(error, 'core-config', {
            cliOptions: options,
            presetOptions: { ...options, corePresets: [], overridePresets: [] },
            skipPrompt: true,
          });
        }
      }
    }
  );

  channel.on(TELEMETRY_ERROR, async (error) => {
    const isTelemetryEnabled = coreOptions.disableTelemetry !== true;

    if (isTelemetryEnabled) {
      await sendTelemetryError(error, 'browser', {
        cliOptions: options,
        presetOptions: { ...options, corePresets: [], overridePresets: [] },
        skipPrompt: true,
      });
    }
  });
}
