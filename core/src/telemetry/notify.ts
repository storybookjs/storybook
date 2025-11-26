import { cache } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

const TELEMETRY_KEY_NOTIFY_DATE = 'telemetry-notification-date';

let called = false;

/**
 * The end-user has already been notified about our telemetry integration. We don't need to
 * constantly annoy them about it. We will re-inform users about the telemetry if significant
 * changes are ever made.
 */
export const notify = async () => {
  if (!called) {
    called = true;

    if (!(await cache.get(TELEMETRY_KEY_NOTIFY_DATE, null))) {
      cache.set(TELEMETRY_KEY_NOTIFY_DATE, Date.now());
      logger.info(
        "Storybook collects completely anonymous usage telemetry. We use it to shape Storybook's roadmap and prioritize features. You can learn more, including how to opt out, at https://storybook.js.org/telemetry"
      );
    }
  }
};
