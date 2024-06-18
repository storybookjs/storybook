import { setOutput } from '@actions/core';
import chalk from 'chalk';
import { program } from 'commander';
import { esMain } from '../utils/esmain';
import { getCurrentVersion } from './get-current-version';
import { getChanges } from './utils/get-changes';

program
  .name('get-version-changelog')
  .description(
    'get changelog for specific version. If no version argument specified it will use the current version in code/package.json'
  )
  .arguments('[version]')
  .option('-V, --verbose', 'Enable verbose logging', false);

export const getVersionChangelog = async (args: { version?: string; verbose?: boolean }) => {
  const version = args.version || (await getCurrentVersion());

  console.log(`📝 Getting changelog for version ${chalk.blue(version)}`);

  const { changelogText } = await getChanges({ from: version, version, verbose: args.verbose });

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('changelog', changelogText);
  }
  return changelogText;
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  getVersionChangelog({ version: parsed.args[0], verbose: parsed.opts().verbose }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
