import type { Channel } from 'storybook/internal/channels';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import versions from '../../common/versions';
import { ADDON_ONBOARDING_CHANNEL } from '../../onboarding/constants';

type Event = {
  type: 'telemetry' | 'survey';
  step: string;
  payload?: any;
};

export function initOnboardingChannel(channel: Channel, options: Options, coreConfig: CoreConfig) {
  if (coreConfig.disableTelemetry) {
    return channel;
  }

  channel.on(ADDON_ONBOARDING_CHANNEL, ({ type, ...event }: Event) => {
    if (type === 'telemetry') {
      telemetry('addon-onboarding', { ...event, addonVersion: versions.storybook });
    } else if (type === 'survey') {
      telemetry('onboarding-survey', { ...event, addonVersion: versions.storybook });
    }
  });

  return channel;
}
