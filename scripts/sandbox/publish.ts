import program from 'commander';
import { dirname, join, relative } from 'path';
import { existsSync } from 'fs';
import { copy, emptyDir, remove, writeFile } from 'fs-extra';
import { execaCommand } from 'execa';

import { getTemplatesData, renderTemplate } from './utils/template';

import { commitAllToGit } from './utils/git';
import { REPROS_DIRECTORY } from '../utils/constants';
import { glob } from 'glob';
import { temporaryDirectory } from '../../code/core/src/common/utils/cli';

export const logger = console;

interface PublishOptions {
  remote?: string;
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

  // otherwise old files will stick around and result inconsistent states
  logger.log(`🗑 Delete existing template dirs from clone`);

  // empty all existing directories for sandboxes that have a successful after-storybook directory
  await Promise.all(
    // find all successfully generated after-storybook/README.md files
    // eg. /home/repros/react-vite/default-ts/after-storybook/README.md
    // README.md being the last file generated, thus representing a successful generation
    (await glob(join(REPROS_DIRECTORY, '**', 'after-storybook/README.md'))).map((readmePath) => {
      // get the after-storybook path relative to the source 'repros' directory
      // eg. ./react-vite/default-ts/after-storybook
      const pathRelativeToSource = relative(REPROS_DIRECTORY, dirname(readmePath));
      // get the actual path to the corresponding sandbox directory in the clone
      // eg. /home/sandboxes-clone/react-vite/default-ts
      const sandboxDirectoryToEmpty = join(tmpFolder, pathRelativeToSource, '..');
      return emptyDir(sandboxDirectoryToEmpty);
    })
  );

  logger.log(`🚚 Moving template files into the repository`);

  const templatePath = join(scriptPath, 'templates', 'root.ejs');
  const templateData = { data: templatesData, version: branch === 'main' ? 'latest' : 'next' };

  const output = await renderTemplate(templatePath, templateData);

  await writeFile(join(tmpFolder, 'README.md'), output);

  logger.log(`🚛 Moving all the repros into the repository`);
  await copy(REPROS_DIRECTORY, tmpFolder);

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
  .option('--remote <remote>', 'Choose the remote to push the contents to')
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
      await remove(tmpFolder);
    }
    process.exit(1);
  });
}

main();
