import { setOutput } from '@actions/core';
import { program } from 'commander';
import picocolors from 'picocolors';

import { esMain } from '../utils/esmain.ts';
import { getCodeWorkspaces } from '../utils/workspace.ts';
import { getCurrentVersion } from './get-current-version.ts';
import { listUnpublishedPackages } from './npm-registry.ts';

program
  .name('is-version-published [version]')
  .description('returns true if the current version is published on npm for every public workspace')
  .arguments('[version]');

export const run = async (args: unknown[], options: unknown) => {
  const { verbose } = options as { verbose?: boolean };

  const version = (args[0] as string) || (await getCurrentVersion());
  const workspaces = await getCodeWorkspaces(false);
  const unpublished = await listUnpublishedPackages({
    packageNames: workspaces.map((workspace) => workspace.name),
    version,
    verbose,
  });

  const isAlreadyPublished = unpublished.length === 0;
  if (isAlreadyPublished) {
    console.log(`⛈️ All public packages are published at ${picocolors.green(version)}`);
  } else {
    console.log(
      `🌤️ ${unpublished.length} public package(s) are not published at ${picocolors.green(version)}: ${unpublished.join(', ')}`
    );
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    setOutput('published', isAlreadyPublished);
  }
  return isAlreadyPublished;
};

if (esMain(import.meta.url)) {
  const parsed = program.parse();
  run(parsed.args, parsed.opts()).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
