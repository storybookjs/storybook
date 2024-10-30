import { logger } from 'storybook/internal/node-logger';

import boxen from 'boxen';
import picocolors from 'picocolors';

import type { AutoblockOptions, Blocker } from './types';

const excludesFalse = <T>(x: T | false): x is T => x !== false;

const blockers: () => BlockerModule<any>[] = () => [
  // add/remove blockers here
  import('./block-storystorev6'),
  import('./block-dependencies-versions'),
  import('./block-node-version'),
];

type BlockerModule<T> = Promise<{ blocker: Blocker<T> }>;

const segmentDivider = '\n\n─────────────────────────────────────────────────\n\n';

export const autoblock = async (
  options: AutoblockOptions,
  list: BlockerModule<any>[] = blockers()
) => {
  if (list.length === 0) {
    return null;
  }

  logger.info('Checking for upgrade blockers...');

  const out = await Promise.all(
    list.map(async (i) => {
      const { blocker } = await i;
      const result = await blocker.check(options);
      if (result) {
        return {
          id: blocker.id,
          value: true,
          log: blocker.log(options, result),
        };
      } else {
        return false;
      }
    })
  );

  const faults = out.filter(excludesFalse);

  if (faults.length > 0) {
    const messages = {
      welcome: `Storybook has found potential blockers in your project that need to be resolved before upgrading:`,
      reminder: picocolors.yellow(
        'Fix the above issues and try running the upgrade command again.'
      ),
    };
    const borderColor = '#FC521F';

    logger.plain(
      boxen(
        [messages.welcome]
          .concat(['\n\n'])
          .concat([faults.map((i) => i.log).join(segmentDivider)])
          .concat([segmentDivider, messages.reminder])
          .join(''),
        { borderStyle: 'round', padding: 1, borderColor }
      )
    );

    return faults[0].id;
  }

  logger.plain('No blockers found.');
  logger.line();

  return null;
};
