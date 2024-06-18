import chalk from 'chalk';
import path from 'path';
import program from 'commander';
import semver from 'semver';
import { z } from 'zod';
import { readFile, writeFile, writeJson } from 'fs-extra';
import { esMain } from '../utils/esmain';
import { getChanges } from './utils/get-changes';

program
  .name('write-changelog')
  .description(
    'write changelog based on merged PRs and commits. the <version> argument describes the changelog entry heading, but NOT which commits/PRs to include, must be a semver string'
  )
  .arguments('<version>')
  .option('-P, --unpicked-patches', 'Set to only consider PRs labeled with "patch:yes" label')
  .option(
    '-F, --from <tag>',
    'Which tag or commit to generate changelog from, eg. "7.0.7". Leave unspecified to select latest released tag in git history'
  )
  .option(
    '-T, --to <tag>',
    'Which tag or commit to generate changelog to, eg. "7.1.0-beta.8". Leave unspecified to select HEAD commit'
  )
  .option('-D, --dry-run', 'Do not write file, only output to shell', false)
  .option('-V, --verbose', 'Enable verbose logging', false);

const optionsSchema = z.object({
  unpickedPatches: z.boolean().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  verbose: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

type Options = {
  unpickedPatches?: boolean;
  from?: string;
  to?: string;
  verbose: boolean;
  dryRun?: boolean;
};

const validateOptions = (args: unknown[], options: { [key: string]: any }): options is Options => {
  optionsSchema.parse(options);
  if (args.length !== 1 || !semver.valid(args[0] as string)) {
    console.error(
      `🚨 Invalid arguments, expected a single argument with the version to generate changelog for, eg. ${chalk.green(
        '7.1.0-beta.8'
      )}`
    );
    return false;
  }
  return true;
};

const writeToChangelogFile = async ({
  changelogText,
  version,
  verbose,
}: {
  changelogText: string;
  version: string;
  verbose?: boolean;
}) => {
  const isPrerelease = semver.prerelease(version) !== null;
  const changelogFilename = isPrerelease ? 'CHANGELOG.prerelease.md' : 'CHANGELOG.md';
  const changelogPath = path.join(__dirname, '..', '..', changelogFilename);

  if (verbose) {
    console.log(`📝 Writing changelog to ${chalk.blue(changelogPath)}`);
  }

  const currentChangelog = await readFile(changelogPath, 'utf-8');
  const nextChangelog = [changelogText, currentChangelog].join('\n\n');

  await writeFile(changelogPath, nextChangelog);
};

const writeToDocsVersionFile = async ({
  changelogText,
  version,
  verbose,
}: {
  changelogText: string;
  version: string;
  verbose?: boolean;
}) => {
  const isPrerelease = semver.prerelease(version) !== null;
  const filename = isPrerelease ? 'next.json' : 'latest.json';
  const filepath = path.join(__dirname, '..', '..', 'docs', 'versions', filename);

  if (verbose) {
    console.log(`📝 Writing changelog to ${chalk.blue(path)}`);
  }

  const textWithoutHeading = changelogText.split('\n').slice(2).join('\n').replaceAll('"', '\\"');

  const content = {
    version,
    info: {
      plain: textWithoutHeading,
    },
  };

  await writeJson(filepath, content);
};

export const run = async (args: unknown[], options: unknown) => {
  if (!validateOptions(args, options)) {
    return;
  }
  const { from, to, unpickedPatches, dryRun, verbose } = options;
  const version = args[0] as string;

  console.log(
    `💬 Generating changelog for ${chalk.blue(version)} between ${chalk.green(
      from || 'latest'
    )} and ${chalk.green(to || 'HEAD')}`
  );

  const { changelogText } = await getChanges({ version, from, to, unpickedPatches, verbose });

  if (dryRun) {
    console.log(`📝 Dry run, not writing file`);
    return;
  }

  await writeToChangelogFile({ changelogText, version, verbose });
  await writeToDocsVersionFile({ changelogText, version, verbose });

  console.log(`✅ Wrote Changelog to file`);
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  run(parsed.args, parsed.opts()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
