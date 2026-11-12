import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';

import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import { existsSync } from 'fs';
// eslint-disable-next-line depend/ban-dependencies
import { glob } from 'glob';
import { dirname, join } from 'pathe';

import { temporaryDirectory } from '../../code/core/src/common/utils/cli.ts';
import { REPROS_DIRECTORY } from '../utils/constants.ts';
import { commitAllToGit } from './utils/git.ts';
import {
  assertPublishedTree,
  ensureLockfilePublishRules,
  sanitizePublishedSandboxes,
} from './utils/sanitize-published-sandbox.ts';
import { getTemplatesData, renderTemplate } from './utils/template.ts';

export const logger = console;

const emptyDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });

  const names = await readdir(dir);
  await Promise.all(names.map((name) => rm(join(dir, name), { recursive: true, force: true })));
};

interface PublishOptions {
  remote: string;
  push?: boolean;
  branch?: string;
}

const publish = async (options: PublishOptions & { tmpFolder: string }) => {
  const { branch: inputBranch, remote, push, tmpFolder } = options;

  const scriptPath = __dirname;
  const branch = inputBranch || 'next';
  const templatesData = await getTemplatesData(branch === 'main' ? 'main' : 'next');

  logger.log(`👯‍♂️ Cloning the repository ${remote} in branch ${branch}`);
  await execaCommand(`git clone ${remote} .`, { cwd: tmpFolder, cleanup: true });
  await execaCommand(`git checkout ${branch}`, { cwd: tmpFolder, cleanup: true });

  // Only templates that generated fully are published, so a failed one keeps its last good
  // before-storybook and after-storybook pair. after-storybook/README.md is the last file generated,
  // eg. react-vite/default-ts/after-storybook/README.md
  const templates = (
    await glob('**/after-storybook/README.md', {
      cwd: REPROS_DIRECTORY,
      ignore: '**/node_modules/**',
    })
  ).map((readmePath) => dirname(dirname(readmePath)));

  logger.log(`🚚 Replacing ${templates.length} generated template(s) in the repository`);
  // Emptied first, otherwise old files would stick around next to the new ones
  await Promise.all(
    templates.map(async (template) => {
      await emptyDir(join(tmpFolder, template));
      await cp(join(REPROS_DIRECTORY, template), join(tmpFolder, template), { recursive: true });
    })
  );

  const templatePath = join(scriptPath, 'templates', 'root.ejs');
  const templateData = { data: templatesData, version: branch === 'main' ? 'latest' : 'next' };

  const output = await renderTemplate(templatePath, templateData);

  await writeFile(join(tmpFolder, 'README.md'), output);

  logger.log(`🧼 Removing install artifacts from the published sandboxes`);
  const { removedPaths } = await sanitizePublishedSandboxes(tmpFolder);
  logger.log(`🧼 Removed ${removedPaths} excluded path(s)`);

  const gitignoreUpdated = await ensureLockfilePublishRules(tmpFolder);
  logger.log(
    gitignoreUpdated
      ? `🧼 Updated the managed lockfile rules in .gitignore`
      : `🧼 .gitignore already publishes the before-storybook lockfile`
  );

  await execaCommand('git add .', { cwd: tmpFolder, cleanup: true });
  await assertPublishedTree(tmpFolder, templates);

  await commitAllToGit({ cwd: tmpFolder, branch });

  logger.info(`
     🙌 All the examples were bootstrapped:
        - in ${tmpFolder}
        - using the '${branch}' version of Storybook CLI
        - and committed on the '${branch}' branch of a local Git repository

     Also all the files in the 'templates' folder were copied at the root of the Git repository.
    `);

  if (push) {
    await execaCommand(`git push --set-upstream origin ${branch}`, {
      cwd: tmpFolder,
    });
    const remoteRepoUrl = `${remote.replace('.git', '')}/tree/${branch}`;
    logger.info(`🚀 Everything was pushed on ${remoteRepoUrl}`);
  } else {
    logger.info(`
       To publish these examples you just need to:
          - push the branch: 'git push --set-upstream origin ${branch}
      `);
  }
};

program
  .description('Create a sandbox from a set of possible templates')
  .requiredOption('--remote <remote>', 'Choose the remote to push the contents to')
  .option('--branch <branch>', 'Choose which branch on the remote')
  .option('--push', 'Whether to push the contents to the remote', false)
  .option('--force-push', 'Whether to force push the changes into the repros repository', false);

program.parse(process.argv);

if (!existsSync(REPROS_DIRECTORY)) {
  throw Error("Couldn't find sandbox directory. Did you forget to run generate-sandboxes?");
}

async function main() {
  const tmpFolder = await temporaryDirectory();
  logger.log(`⏱ Created tmp folder: ${tmpFolder}`);

  const options = program.opts() as PublishOptions;

  publish({ ...options, tmpFolder }).catch(async (e) => {
    logger.error(e);

    if (existsSync(tmpFolder)) {
      logger.log('🚮 Removing the temporary folder..');
      await rm(tmpFolder, { force: true, recursive: true });
    }
    process.exit(1);
  });
}

main();
