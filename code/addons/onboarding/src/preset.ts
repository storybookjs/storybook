import { readFileSync } from 'node:fs';

import type { Channel } from 'storybook/internal/channels';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import { STORYBOOK_ADDON_ONBOARDING_CHANNEL } from './constants';

type Event = {
  type: 'telemetry' | 'survey';
  step: string;
  payload?: any;
};

export const experimental_serverChannel = async (channel: Channel, options: Options) => {
  const { disableTelemetry } = await options.presets.apply<CoreConfig>('core', {});

  if (!disableTelemetry) {
    const packageJsonPath = require.resolve('@storybook/addon-onboarding/package.json');

    const { version: addonVersion } = JSON.parse(
      readFileSync(packageJsonPath, { encoding: 'utf-8' })
    );

    channel.on(STORYBOOK_ADDON_ONBOARDING_CHANNEL, ({ type, ...event }: Event) => {
      if (type === 'telemetry') {
        telemetry('addon-onboarding', { ...event, addonVersion });
      } else if (type === 'survey') {
        telemetry('onboarding-survey', { ...event, addonVersion });
      }
    });
  }

  return channel;
};
