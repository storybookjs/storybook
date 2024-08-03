import chalk from 'chalk';
import { colors } from '@storybook/core/node-logger';
import boxen from 'boxen';
import { dedent } from 'ts-dedent';
import Table from 'cli-table3';
import prettyTime from 'pretty-hrtime';
import type { VersionCheck } from '@storybook/core/types';
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
    ['Local:', chalk.cyan(address)],
    ['On your network:', chalk.cyan(networkAddress)]
  );

  const timeStatement = [
    managerTotalTime && `${chalk.underline(prettyTime(managerTotalTime))} for manager`,
    previewTotalTime && `${chalk.underline(prettyTime(previewTotalTime))} for preview`,
  ]
    .filter(Boolean)
    .join(' and ');

  console.log(
    boxen(
      dedent`
          ${colors.green(`Storybook ${chalk.bold(version)} for ${chalk.bold(name)} started`)}
          ${chalk.gray(timeStatement)}

          ${serveMessage.toString()}${updateMessage ? `\n\n${updateMessage}` : ''}
        `,
      { borderStyle: 'round', padding: 1, borderColor: '#F1618C' } as any
    )
  );
}
