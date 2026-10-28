import type { Channel } from '@storybook/core/internal/channels';
import { telemetry } from '@storybook/core/internal/telemetry';

import { version as addonVersion } from '../../package.json';
import { ADDON_ONBOARDING_CHANNEL } from '../constants.ts';

type Event = {
  type: 'telemetry' | 'survey';
  step: string;
  payload?: any;
};

/** Forward onboarding and survey events from the manager to telemetry. */
export function forwardOnboardingTelemetry(channel: Channel): void {
  channel.on(ADDON_ONBOARDING_CHANNEL, ({ type, ...event }: Event) => {
    if (type === 'telemetry') {
      telemetry('addon-onboarding', { ...event, addonVersion });
    } else if (type === 'survey') {
      telemetry('onboarding-survey', { ...event, addonVersion });
    }
  });
}
