import type { Channel } from 'storybook/internal/channels';
import { telemetry } from 'storybook/internal/telemetry';
import type { CoreConfig, Options } from 'storybook/internal/types';

import versions from '../../common/versions';
import { STORYBOOK_ADDON_ONBOARDING_CHANNEL } from '../../onboarding/constants';

type Event = {
  type: 'telemetry' | 'survey';
  step: string;
  payload?: any;
};

const addonVersion = versions.storybook;

export async function initOnboarding(channel: Channel, options: Options, coreOptions: CoreConfig) {
  const { disableTelemetry } = await options.presets.apply<CoreConfig>('core', {});

  if (disableTelemetry) {
    return channel;
  }

  channel.on(STORYBOOK_ADDON_ONBOARDING_CHANNEL, ({ type, ...event }: Event) => {
    if (type === 'telemetry') {
      telemetry('addon-onboarding', { ...event, addonVersion });
    } else if (type === 'survey') {
      telemetry('onboarding-survey', { ...event, addonVersion });
    }
  });

  return channel;
}
