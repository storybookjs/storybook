import { join } from 'node:path';

import { setOutput } from '@actions/core';
import chalk from 'chalk';
import { program } from 'commander';
import { readFile } from 'fs-extra';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { esMain } from '../utils/esmain';
import { getCurrentVersion } from './get-current-version';

program
  .name('get-changelog-from-file')
  .description(
    'get changelog entry for specific version. If no version argument specified it will use the current version in code/package.json'
  )
  .arguments('[version]')
  .option('-E, --no-escape', 'Escape quote-like characters, so the output is safe in CLIs', true)
  .option('-V, --verbose', 'Enable verbose logging', false);

export const getChangelogFromFile = async (args: {
  version?: string;
  escape?: boolean;
  verbose?: boolean;
}) => {
  const version = args.version || (await getCurrentVersion());
  const isPrerelease = semver.prerelease(version) !== null;
  const changelogFilename = isPrerelease ? 'CHANGELOG.prerelease.md' : 'CHANGELOG.md';
  const changelogPath = join(__dirname, '..', '..', changelogFilename);

  console.log(`📝 Getting changelog from ${chalk.blue(changelogPath)}`);

  const fullChangelog = await readFile(changelogPath, 'utf-8');
  const changelogForVersion = fullChangelog.split(/(^|\n)## /).find((v) => v.startsWith(version));
  if (!changelogForVersion) {
    throw new Error(
      `Could not find changelog entry for version ${chalk.blue(version)} in ${chalk.green(
        changelogPath
      )}`
    );
  }
  const result = args.escape
    ? `## ${changelogForVersion}`
        .replaceAll('"', '\\"')
        .replaceAll('`', '\\`')
        .replaceAll("'", "\\'")
    : `## ${changelogForVersion}`;

  console.log(dedent`📝 Changelog entry found:
      ${result}`);

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('changelog', result);
  }
  return result;
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  getChangelogFromFile({
    version: parsed.args[0],
    escape: parsed.opts().escape,
    verbose: parsed.opts().verbose,
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
