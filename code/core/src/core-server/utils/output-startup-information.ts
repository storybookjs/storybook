import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import type { VersionCheck } from 'storybook/internal/types';

import picocolors from 'picocolors';
import prettyTime from 'pretty-hrtime';
import { dedent } from 'ts-dedent';

import { createUpdateMessage } from './update-check';

export function outputStartupInformation(options: {
  updateInfo: VersionCheck;
  version: string;
  name: string;
  address: string;
  networkAddress: string;
  managerTotalTime?: [number, number];
  previewTotalTime?: [number, number];
}) {
  const { updateInfo, version, name, address, networkAddress, managerTotalTime, previewTotalTime } =
    options;

  const updateMessage = createUpdateMessage(updateInfo, version);

  const serverMessages = [
    `- Local:             ${address}`,
    `- On your network:   ${networkAddress}`,
  ];

  logger.logBox(
    dedent`
      Storybook ready!
      
      ${serverMessages.join('\n')}${updateMessage ? `\n\n${updateMessage}` : ''}
    `,
    {
      formatBorder: CLI_COLORS.storybook,
      contentPadding: 3,
      rounded: true,
    }
  );

  const timeStatement = [
    managerTotalTime && `${picocolors.underline(prettyTime(managerTotalTime))} for manager`,
    previewTotalTime && `${picocolors.underline(prettyTime(previewTotalTime))} for preview`,
  ]
    .filter(Boolean)
    .join(' and ');

  logger.info(timeStatement);
}
