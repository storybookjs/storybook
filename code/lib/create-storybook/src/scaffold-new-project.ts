import { readdirSync } from 'node:fs';
import { rm } from 'node:fs/promises';

import boxen from 'boxen';
// eslint-disable-next-line depend/ban-dependencies
import execa from 'execa';
import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

import type { PackageManagerName } from '../../../core/src/common/js-package-manager/JsPackageManager';
import { logger } from '../../../core/src/node-logger';
import { GenerateNewProjectOnInitError } from '../../../core/src/server-errors';
import { telemetry } from '../../../core/src/telemetry';
import type { CommandOptions } from './generators/types';

type CoercedPackageManagerName = 'npm' | 'yarn' | 'pnpm';

interface SupportedProject {
  displayName: {
    type: string;
    builder?: string;
    language: string;
  };
  createScript: Record<CoercedPackageManagerName, string>;
}

/** The supported projects. */
const SUPPORTED_PROJECTS: Record<string, SupportedProject> = {
  'react-vite-ts': {
    displayName: {
      type: 'React',
      builder: 'Vite',
      language: 'TS',
    },
    createScript: {
      npm: 'npm create vite@latest . -- --template react-ts',
      yarn: 'yarn create vite . --template react-ts',
      pnpm: 'pnpm create vite@latest . --template react-ts',
    },
  },
  'nextjs-ts': {
    displayName: {
      type: 'Next.js',
      language: 'TS',
    },
    createScript: {
      npm: 'npm create next-app . -- --turbopack --typescript --use-npm --eslint --tailwind --no-app --import-alias="@/*" --src-dir',
      // yarn doesn't support version ranges, so we have to use npx
      yarn: 'npx create-next-app . --turbopack --typescript --use-yarn --eslint --tailwind --no-app --import-alias="@/*" --src-dir',
      pnpm: 'pnpm create next-app . --turbopack --typescript --use-pnpm --eslint --tailwind --no-app --import-alias="@/*" --src-dir',
    },
  },
  'vue-vite-ts': {
    displayName: {
      type: 'Vue 3',
      builder: 'Vite',
      language: 'TS',
    },
    createScript: {
      npm: 'npm create vite@latest . -- --template vue-ts',
      yarn: 'yarn create vite . --template vue-ts',
      pnpm: 'pnpm create vite@latest . --template vue-ts',
    },
  },
  'angular-cli': {
    displayName: {
      type: 'Angular',
      language: 'TS',
    },
    createScript: {
      npm: 'npx -p @angular/cli@latest ng new angular-latest --directory . --routing=true --minimal=true --style=scss --strict --skip-git --skip-install',
      yarn: 'yarn dlx -p @angular/cli ng new angular-latest --directory . --routing=true --minimal=true --style=scss --strict --skip-git --package-manager=yarn --skip-install && touch yarn.lock && yarn set version berry && yarn config set nodeLinker node-modules',
      pnpm: 'pnpm --package @angular/cli dlx ng new angular-latest --directory . --routing=true --minimal=true --style=scss --strict --skip-git --package-manager=pnpm --skip-install',
    },
  },
  'lit-vite-ts': {
    displayName: {
      type: 'Lit',
      builder: 'Vite',
      language: 'TS',
    },
    createScript: {
      npm: 'npm create vite@latest . -- --template lit-ts',
      yarn: 'yarn create vite . --template lit-ts && touch yarn.lock && yarn set version berry && yarn config set nodeLinker pnp',
      pnpm: 'pnpm create vite@latest . --template lit-ts',
    },
  },
};

const packageManagerToCoercedName = (
  packageManager: PackageManagerName
): CoercedPackageManagerName => {
  switch (packageManager) {
    case 'npm':
      return 'npm';
    case 'pnpm':
      return 'pnpm';
    default:
      return 'yarn';
  }
};

const buildProjectDisplayNameForPrint = ({ displayName }: SupportedProject) => {
  const { type, builder, language } = displayName;
  return `${picocolors.bold(picocolors.blue(type))} ${builder ? `+ ${builder} ` : ''}(${language})`;
};

/**
 * Scaffold a new project.
 *
 * @param packageManager The package manager to use.
 */
export const scaffoldNewProject = async (
  packageManager: PackageManagerName,
  { disableTelemetry }: CommandOptions
) => {
  const packageManagerName = packageManagerToCoercedName(packageManager);

  logger.plain(
    boxen(
      dedent`
        Would you like to generate a new project from the following list?

        ${picocolors.bold('Note:')}
        Storybook supports many more frameworks and bundlers than listed below. If you don't see your
        preferred setup, you can still generate a project then rerun this command to add Storybook.

        ${picocolors.bold('Press ^C at any time to quit.')}
      `,
      {
        title: picocolors.bold('🔎 Empty directory detected'),
        padding: 1,
        borderStyle: 'double',
        borderColor: 'yellow',
      }
    )
  );
  logger.line(1);

  let projectStrategy;

  if (process.env.STORYBOOK_INIT_EMPTY_TYPE) {
    projectStrategy = process.env.STORYBOOK_INIT_EMPTY_TYPE;
  }

  if (!projectStrategy) {
    const { project } = await prompts(
      {
        type: 'select',
        name: 'project',
        message: 'Choose a project template',
        choices: Object.entries(SUPPORTED_PROJECTS).map(([key, value]) => ({
          title: buildProjectDisplayNameForPrint(value),
          value: key,
        })),
      },
      { onCancel: () => process.exit(0) }
    );

    projectStrategy = project;
  }

  const projectStrategyConfig = SUPPORTED_PROJECTS[projectStrategy];
  const projectDisplayName = buildProjectDisplayNameForPrint(projectStrategyConfig);
  const createScript = projectStrategyConfig.createScript[packageManagerName];

  logger.line(1);
  logger.plain(
    `Creating a new "${projectDisplayName}" project with ${picocolors.bold(packageManagerName)}...`
  );
  logger.line(1);

  const targetDir = process.cwd();

  try {
    // If target directory has a .cache folder, remove it
    // so that it does not block the creation of the new project
    await rm(`${targetDir}/.cache`, { recursive: true, force: true });
  } catch (e) {
    //
  }
  try {
    // If target directory has a node_modules folder, remove it
    // so that it does not block the creation of the new project
    await rm(`${targetDir}/node_modules`, { recursive: true, force: true });
  } catch (e) {
    //
  }

  try {
    // Create new project in temp directory
    await execa.command(createScript, {
      stdio: 'pipe',
      shell: true,
      cwd: targetDir,
      cleanup: true,
    });
  } catch (e) {
    throw new GenerateNewProjectOnInitError({
      error: e,
      packageManager: packageManagerName,
      projectType: projectStrategy,
    });
  }

  if (!disableTelemetry) {
    telemetry('scaffolded-empty', {
      packageManager: packageManagerName,
      projectType: projectStrategy,
    });
  }

  logger.plain(
    boxen(
      dedent`
      "${projectDisplayName}" project with ${picocolors.bold(
        packageManagerName
      )} created successfully!

      Continuing with Storybook installation...
    `,
      {
        title: picocolors.bold('✅ Success!'),
        padding: 1,
        borderStyle: 'double',
        borderColor: 'green',
      }
    )
  );
  logger.line(1);
};

const FILES_TO_IGNORE = [
  '.git',
  '.gitignore',
  '.DS_Store',
  '.cache',
  'node_modules',
  '.yarnrc.yml',
  '.yarn',
];

export const currentDirectoryIsEmpty = () => {
  const cwdFolderEntries = readdirSync(process.cwd());

  return (
    cwdFolderEntries.length === 0 ||
    cwdFolderEntries.every((entry) => FILES_TO_IGNORE.includes(entry))
  );
};
