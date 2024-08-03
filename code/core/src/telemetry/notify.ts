import chalk from 'chalk';
import { cache } from '@storybook/core/common';

const TELEMETRY_KEY_NOTIFY_DATE = 'telemetry-notification-date';

const logger = console;

export const notify = async () => {
  const telemetryNotifyDate = await cache.get(TELEMETRY_KEY_NOTIFY_DATE, null);
  // The end-user has already been notified about our telemetry integration. We
  // don't need to constantly annoy them about it.
  // We will re-inform users about the telemetry if significant changes are
  // ever made.
  if (telemetryNotifyDate) {
    return;
  }

  cache.set(TELEMETRY_KEY_NOTIFY_DATE, Date.now());

  logger.log();
  logger.log(
    `${chalk.magenta.bold(
      'attention'
    )} => Storybook now collects completely anonymous telemetry regarding usage.`
  );
  logger.log(`This information is used to shape Storybook's roadmap and prioritize features.`);
  logger.log(
    `You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:`
  );
  logger.log(chalk.cyan('https://storybook.js.org/telemetry'));
  logger.log();
};
