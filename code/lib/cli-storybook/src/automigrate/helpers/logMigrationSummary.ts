import { CLI_COLORS, logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { FixSummary } from '../types';
import { FixStatus } from '../types';

export const messageDivider = '\n\n';
const segmentDivider = '\n\n─────────────────────────────────────────────────\n\n';

function getGlossaryMessages(fixSummary: FixSummary, fixResults: Record<string, FixStatus>) {
  const messages = [];
  if (fixSummary.succeeded.length > 0) {
    messages.push(picocolors.bold('Successful migrations:'));
    messages.push(fixSummary.succeeded.map((m) => picocolors.green(m)).join(', '));
  }

  if (Object.keys(fixSummary.failed).length > 0) {
    messages.push(picocolors.bold('Failed migrations:'));
    messages.push(
      Object.entries(fixSummary.failed)
        .map(([id, error]) => {
          return `${picocolors.bold(picocolors.red(id))}:\n${error}`;
        })
        .join('\n')
    );
  }

  if (fixSummary.manual.length > 0) {
    messages.push(picocolors.bold('Manual migrations:'));
    messages.push(
      fixSummary.manual
        .map((m) =>
          fixResults[m] === FixStatus.MANUAL_SUCCEEDED ? picocolors.green(m) : picocolors.blue(m)
        )
        .join(', ')
    );
  }

  if (fixSummary.skipped.length > 0) {
    messages.push(picocolors.bold('Skipped migrations:'));
    messages.push(fixSummary.skipped.map((m) => picocolors.cyan(m)).join(', '));
  }

  return messages;
}

export function logMigrationSummary({
  fixResults,
  fixSummary,
}: {
  fixResults: Record<string, FixStatus>;
  fixSummary: FixSummary;
}) {
  const messages = [];
  messages.push(getGlossaryMessages(fixSummary, fixResults).join(messageDivider));

  messages.push(dedent`If you'd like to run the migrations again, you can do so by running 
    ${picocolors.cyan('npx storybook automigrate')}
    
    The automigrations try to migrate common patterns in your project, but might not contain everything needed to migrate to the latest version of Storybook.
    
    Please check the changelog and migration guide for manual migrations and more information: 
    https://storybook.js.org/docs/releases/migration-guide?ref=upgrade
    And reach out on Discord if you need help: https://discord.gg/storybook
  `);

  const hasNoFixes = Object.values(fixResults).every((r) => r === FixStatus.UNNECESSARY);
  const hasFailures = Object.values(fixResults).some(
    (r) => r === FixStatus.FAILED || r === FixStatus.CHECK_FAILED
  );

  if (hasNoFixes) {
    logger.warn('No migrations were applicable to your project');
  } else if (hasFailures) {
    logger.error('Migration check ran with failures');
  } else {
    logger.step(CLI_COLORS.success('Migration check ran successfully'));
  }

  logger.log(messages.filter(Boolean).join(segmentDivider));
}
