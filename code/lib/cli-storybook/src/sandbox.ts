import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';

import type { PackageManagerName } from 'storybook/internal/common';
import { JsPackageManagerFactory } from 'storybook/internal/common';
import { versions } from 'storybook/internal/common';

import boxen from 'boxen';
import { initiate } from 'create-storybook';
import { downloadTemplate } from 'giget';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { lt, prerelease } from 'semver';
import invariant from 'tiny-invariant';
import { dedent } from 'ts-dedent';

import type { Template, TemplateKey } from './sandbox-templates';
import { allTemplates as TEMPLATES } from './sandbox-templates';

const logger = console;

interface SandboxOptions {
  filterValue?: string;
  output?: string;
  branch?: string;
  init?: boolean;
  packageManager: PackageManagerName;
}
type Choice = keyof typeof TEMPLATES;

const toChoices = (c: Choice): prompts.Choice => ({ title: TEMPLATES[c].name, value: c });

export const sandbox = async ({
  output: outputDirectory,
  filterValue,
  init,
  ...options
}: SandboxOptions) => {
  // Either get a direct match when users pass a template id, or filter through all templates
  let selectedConfig: Template | undefined = TEMPLATES[filterValue as TemplateKey];
  let templateId: Choice | null = selectedConfig ? (filterValue as TemplateKey) : null;

  const { packageManager: pkgMgr } = options;

  const packageManager = JsPackageManagerFactory.getPackageManager({
    force: pkgMgr,
  });
  const latestVersion = await packageManager.latestVersion('storybook');
  const nextVersion = await packageManager.latestVersion('storybook@next').catch((e) => '0.0.0');
  const currentVersion = versions.storybook;
  const isPrerelease = prerelease(currentVersion);
  const isOutdated = lt(currentVersion, isPrerelease ? nextVersion : latestVersion);
  const borderColor = isOutdated ? '#FC521F' : '#F1618C';

  const downloadType = !isOutdated && init ? 'after-storybook' : 'before-storybook';
  const branch = isPrerelease ? 'next' : 'main';

  const messages = {
    welcome: `Creating a Storybook ${picocolors.bold(currentVersion)} sandbox..`,
    notLatest: picocolors.red(dedent`
      This version is behind the latest release, which is: ${picocolors.bold(latestVersion)}!
      You likely ran the init command through npx, which can use a locally cached version, to get the latest please run:
      ${picocolors.bold('npx storybook@latest sandbox')}
      
      You may want to CTRL+C to stop, and run with the latest version instead.
    `),
    longInitTime: picocolors.yellow(
      'The creation of the sandbox will take longer, because we will need to run init.'
    ),
    prerelease: picocolors.yellow('This is a pre-release version.'),
  };

  logger.log(
    boxen(
      [messages.welcome]
        .concat(isOutdated && !isPrerelease ? [messages.notLatest] : [])
        .concat(init && (isOutdated || isPrerelease) ? [messages.longInitTime] : [])
        .concat(isPrerelease ? [messages.prerelease] : [])
        .join('\n'),
      { borderStyle: 'round', padding: 1, borderColor }
    )
  );

  if (!selectedConfig) {
    const filterRegex = new RegExp(`^${filterValue || ''}`, 'i');

    const keys = Object.keys(TEMPLATES) as Choice[];
    // get value from template and reduce through TEMPLATES to filter out the correct template
    const choices = keys.reduce<Choice[]>((acc, group) => {
      const current = TEMPLATES[group];

      if (!filterValue) {
        acc.push(group);
        return acc;
      }

      if (
        current.name.match(filterRegex) ||
        group.match(filterRegex) ||
        current.expected.builder.match(filterRegex) ||
        current.expected.framework.match(filterRegex) ||
        current.expected.renderer.match(filterRegex)
      ) {
        acc.push(group);
        return acc;
      }

      return acc;
    }, []);

    if (choices.length === 0) {
      logger.info(
        boxen(
          dedent`
            🔎 You filtered out all templates. 🔍

            After filtering all the templates with "${picocolors.yellow(
              filterValue
            )}", we found no results. Please try again with a different filter.

            Available templates:
            ${keys.map((key) => picocolors.blue(`- ${key}`)).join('\n')}
            `.trim(),
          { borderStyle: 'round', padding: 1, borderColor: '#F1618C' } as any
        )
      );
      process.exit(1);
    }

    if (choices.length === 1) {
      [templateId] = choices;
    } else {
      logger.info(
        boxen(
          dedent`
            🤗 Welcome to ${picocolors.yellow('sb sandbox')}! 🤗

            Create a ${picocolors.green('new project')} to minimally reproduce Storybook issues.

            1. select an environment that most closely matches your project setup.
            2. select a location for the reproduction, outside of your project.

            After the reproduction is ready, we'll guide you through the next steps.
            `.trim(),
          { borderStyle: 'round', padding: 1, borderColor: '#F1618C' } as any
        )
      );

      templateId = await promptSelectedTemplate(choices);
    }

    const hasSelectedTemplate = !!(templateId ?? null);
    if (!hasSelectedTemplate) {
      logger.error('Somehow we got no templates. Please rerun this command!');
      return;
    }

    selectedConfig = templateId ? TEMPLATES[templateId] : undefined;

    if (!selectedConfig) {
      throw new Error('🚨 Sandbox: please specify a valid template type');
    }
  }

  let selectedDirectory = outputDirectory;
  const outputDirectoryName = outputDirectory || templateId;
  if (selectedDirectory && existsSync(`${selectedDirectory}`)) {
    logger.info(`⚠️  ${selectedDirectory} already exists! Overwriting...`);
  }

  if (!selectedDirectory) {
    const { directory } = await prompts(
      {
        type: 'text',
        message: 'Enter the output directory',
        name: 'directory',
        initial: outputDirectoryName ?? undefined,
        validate: async (directoryName) =>
          existsSync(directoryName)
            ? `${directoryName} already exists. Please choose another name.`
            : true,
      },
      {
        onCancel: () => {
          logger.log('Command cancelled by the user. Exiting...');
          process.exit(1);
        },
      }
    );
    selectedDirectory = directory;
  }
  invariant(selectedDirectory);

  try {
    const templateDestination = isAbsolute(selectedDirectory)
      ? selectedDirectory
      : join(process.cwd(), selectedDirectory);

    logger.info(`🏃 Adding ${selectedConfig.name} into ${templateDestination}`);

    logger.log(`📦 Downloading sandbox template (${picocolors.bold(downloadType)})...`);
    try {
      // Download the sandbox based on subfolder "after-storybook" and selected branch
      const gitPath = `github:storybookjs/sandboxes/${templateId}/${downloadType}#${branch}`;
      await downloadTemplate(gitPath, {
        force: true,
        dir: templateDestination,
      });
      // throw an error if templateDestination is an empty directory
      if ((await readdir(templateDestination)).length === 0) {
        const selected = picocolors.yellow(templateId);
        throw new Error(dedent`
          Template downloaded from ${picocolors.blue(gitPath)} is empty.
          Are you use it exists? Or did you want to set ${selected} to inDevelopment first?
        `);
      }

      // when user wanted an sandbox that has been initiated, but force-downloaded the before-storybook directory
      // then we need to initiate the sandbox
      // this is to ensure we DO get the latest version of the template (output of the generator), but we initialize using the version of storybook that the CLI is.
      // we warned the user about the fact they are running an old version of storybook
      // we warned the user the sandbox step would take longer
      if (downloadType === 'before-storybook' && init) {
        const before = process.cwd();
        process.chdir(templateDestination);
        // we run doInitiate, instead of initiate, to avoid sending this init event to telemetry, because it's not a real world project
        await initiate({
          dev: process.env.CI !== 'true' && process.env.IN_STORYBOOK_SANBOX !== 'true',
          ...options,
        });
        process.chdir(before);
      }
    } catch (err) {
      logger.error(`🚨 Failed to download sandbox template: ${String(err)}`);
      throw err;
    }

    const initMessage = init
      ? picocolors.yellow(dedent`
          yarn install
          yarn storybook
        `)
      : `Recreate your setup, then ${picocolors.yellow(`npx storybook@latest init`)}`;

    logger.info(
      boxen(
        dedent`
        🎉 Your Storybook reproduction project is ready to use! 🎉

        ${picocolors.yellow(`cd ${selectedDirectory}`)}
        ${initMessage}

        Once you've recreated the problem you're experiencing, please:

        1. Document any additional steps in ${picocolors.cyan('README.md')}
        2. Publish the repository to github
        3. Link to the repro repository in your issue

        Having a clean repro helps us solve your issue faster! 🙏
      `.trim(),
        { borderStyle: 'round', padding: 1, borderColor: '#F1618C' } as any
      )
    );
  } catch (error) {
    logger.error('🚨 Failed to create sandbox');
    throw error;
  }
};

async function promptSelectedTemplate(choices: Choice[]): Promise<Choice | null> {
  const { template } = await prompts(
    {
      type: 'select',
      message: '🌈 Select the template',
      name: 'template',
      choices: choices.map(toChoices),
    },
    {
      onCancel: () => {
        logger.log('Command cancelled by the user. Exiting...');
        process.exit(1);
      },
    }
  );

  return template || null;
}
