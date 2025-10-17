import { CLI_COLORS, logger } from 'storybook/internal/node-logger';
import type { VersionCheck } from 'storybook/internal/types';

import Table from 'cli-table3';
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

  const serveMessage = new Table({
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: '',
    },
    // @ts-expect-error (Converted from ts-ignore)
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    paddingBottom: 0,
  });

  serveMessage.push(
    ['Local:', picocolors.cyan(address)],
    ['On your network:', picocolors.cyan(networkAddress)]
  );

  const timeStatement = [
    managerTotalTime && `${picocolors.underline(prettyTime(managerTotalTime))} for manager`,
    previewTotalTime && `${picocolors.underline(prettyTime(previewTotalTime))} for preview`,
  ]
    .filter(Boolean)
    .join(' and ');

  logger.log(
    dedent`
      ${CLI_COLORS.success(
        `Storybook ${picocolors.bold(version)} for ${picocolors.bold(name)} started`
      )}
      ${timeStatement}

      ${serveMessage.toString()}${updateMessage ? `\n\n${updateMessage}` : ''}
    `
  );
}
