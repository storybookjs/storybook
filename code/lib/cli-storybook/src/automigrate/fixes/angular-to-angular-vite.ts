import { types as t } from 'storybook/internal/babel';
import {
  ANALOG_VITE_PLUGIN_ANGULAR_VERSION,
  editJsonText,
  isStorybookTarget,
  parseJsonText,
  type StorybookBuilderTarget,
  toDevkitVersion,
} from 'storybook/internal/cli';
import {
  type JsPackageManager,
  formatFileContent,
  getProjectRoot,
  transformImports,
} from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { dirname, relative, resolve } from 'pathe';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import type { FixFiles } from '../fix-files.ts';
import { automigrationLogger } from '../helpers/automigration-logger.ts';
import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { FixTransform } from '../pipeline.ts';
import { assertMainConfigNamesFramework } from '../helpers/main-config-framework.ts';
import { readJsonFile } from '../helpers/workspace-files.ts';
import type { Fix } from '../types.ts';
import { findWorkspaceJsonFiles, getTargetGroups } from './angular-workspace.ts';
import {
  compodocTransforms,
  findCompodocSetup,
  removeCompodocSetup,
} from './angular-vite-remove-compodoc.ts';

export const ANGULAR_PACKAGE = '@storybook/angular';
export const ANALOG_PACKAGE = '@analogjs/storybook-angular';
export const ANGULAR_VITE_PACKAGE = '@storybook/angular-vite';
const ANALOG_VITE_PLUGIN_PACKAGE = '@analogjs/vite-plugin-angular';

const ANGULAR_BUILD_PACKAGE = '@angular/build';
const ANGULAR_ANIMATIONS_PACKAGE = '@angular/animations';
const ANGULAR_DEVKIT_ARCHITECT_PACKAGE = '@angular-devkit/architect';

const MIGRATABLE_FRAMEWORKS = [ANGULAR_PACKAGE, ANALOG_PACKAGE] as const;
type MigratableFramework = (typeof MIGRATABLE_FRAMEWORKS)[number];

const FRAMEWORK_DOC_URL = 'https://storybook.js.org/docs/get-started/frameworks/angular-vite';
const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

const ANGULAR_MIN_MAJOR = 21;

interface AngularToAngularViteOptions {
  framework: MigratableFramework;
  angularVersion: string | null;
  hasWebpackFinal: boolean;
  /**
   * `import`: a Storybook target exists and `zone.js` is installed, so the preview imports it.
   * `missing`: a target is zone-based but `zone.js` is not installed.
   */
  zoneJs: 'unneeded' | 'import' | 'missing';
}

const IMPORT_RENAMES = Object.fromEntries(
  MIGRATABLE_FRAMEWORKS.map((pkg) => [pkg, ANGULAR_VITE_PACKAGE])
);

const rewriteBuilderRefs = (content: string): string =>
  MIGRATABLE_FRAMEWORKS.reduce(
    (acc, framework) =>
      acc
        .replaceAll(`${framework}:start-storybook`, `${ANGULAR_VITE_PACKAGE}:start-storybook`)
        .replaceAll(`${framework}:build-storybook`, `${ANGULAR_VITE_PACKAGE}:build-storybook`),
    content
  );

const VITE_CONFIG_FILES = ['vite.config', 'vitest.config'].flatMap((basename) =>
  ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'].map((ext) => basename + ext)
);

// `storybookAngularVitest()` must share the `plugins` array with `storybookTest()` so standalone
// vitest runs receive the Angular build options.
const buildAngularVitestConfig = (
  configDirRelative: string
): string => `import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { storybookAngularVitest } from '@storybook/angular-vite/vitest';

import { playwright } from '@vitest/browser-playwright';

const dirname =
  typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        plugins: [
          // Forwards Angular build options (styles, assets, zoneless, …) into standalone vitest runs
          storybookAngularVitest({}),
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({ configDir: path.join(dirname, '${configDirRelative}') }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
`;

const isMigratableStorybookTarget = (target: unknown): target is StorybookBuilderTarget =>
  MIGRATABLE_FRAMEWORKS.some((framework) => isStorybookTarget(target, framework));

/**
 * `getFrameworkPackageName` maps a resolved path back to a package name only for frameworks
 * Storybook ships, so `@analogjs/storybook-angular` can arrive as an installed package directory or
 * a pnpm virtual-store dir that spells the scope slash as `+`.
 */
const matchMigratableFramework = (frameworkPackageName: string | null) => {
  const normalized = frameworkPackageName?.replace(/\\/g, '/');
  return MIGRATABLE_FRAMEWORKS.find(
    (framework) =>
      normalized === framework ||
      // The leading slash keeps `@storybook/angular` from matching `@storybook/angular-vite`.
      normalized?.endsWith(`/${framework}`) ||
      normalized?.includes(`/.pnpm/${framework.replace('/', '+')}@`)
  );
};

/**
 * Detection is wider than the rewrite: a multi-project upgrade runs each project against the tree
 * the first project already rewrote, and a narrower gate would skip the zone.js import.
 */
const resolveZoneJs = (
  workspaceJson: unknown[],
  hasZoneJsDependency: boolean
): AngularToAngularViteOptions['zoneJs'] => {
  let hasStorybookTarget = false;
  let anyZoneBasedTarget = false;
  for (const json of workspaceJson) {
    for (const { targets } of getTargetGroups(json)) {
      for (const target of Object.values(targets)) {
        if (
          !isMigratableStorybookTarget(target) &&
          !isStorybookTarget(target, ANGULAR_VITE_PACKAGE)
        ) {
          continue;
        }
        hasStorybookTarget = true;
        // An earlier run may already have renamed the key, so both spellings count.
        anyZoneBasedTarget ||=
          (target.options?.zoneless ?? target.options?.experimentalZoneless) === false;
      }
    }
  }
  if (hasStorybookTarget && hasZoneJsDependency) {
    return 'import';
  }
  return anyZoneBasedTarget ? 'missing' : 'unneeded';
};

/**
 * Rewrite the builder refs and rename `experimentalZoneless` to `zoneless` in every Storybook target
 * of the given `angular.json` or Nx `project.json` files.
 */
const rewriteWorkspaceJson = (files: FixFiles, paths: string[]) =>
  files.edit(paths, (source) => {
    let content = source;
    for (const { pathPrefix, targets } of getTargetGroups(parseJsonText(source))) {
      for (const [targetName, target] of Object.entries(targets)) {
        if (!isMigratableStorybookTarget(target)) {
          continue;
        }
        const targetPath = [...pathPrefix, targetName];
        const refKey = 'builder' in target ? 'builder' : 'executor';
        content = editJsonText(
          content,
          [...targetPath, refKey],
          rewriteBuilderRefs((target.builder ?? target.executor)!)
        );
        if (target.options && 'experimentalZoneless' in target.options) {
          content = editJsonText(
            content,
            [...targetPath, 'options', 'zoneless'],
            target.options.zoneless ?? target.options.experimentalZoneless
          );
          content = editJsonText(
            content,
            [...targetPath, 'options', 'experimentalZoneless'],
            undefined
          );
        }
      }
    }
    return content;
  });

const addZoneJsImport: FixTransform = {
  filter: { kind: ['preview'] },
  editConfig: (preview, { id }) => {
    const hasZoneJsImport = preview._ast.program.body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        (node.source.value === 'zone.js' || node.source.value.startsWith('zone.js/'))
    );
    if (hasZoneJsImport) {
      return;
    }
    preview.setImport(null, 'zone.js');
    logger.debug(`Added a \`zone.js\` import to ${id}`);
  },
};

const getGuaranteedAngularMajor = (specifier: string | null): number | null => {
  const range = specifier ? semver.validRange(specifier) : null;
  const major = range ? (semver.minVersion(range)?.major ?? null) : null;
  return major === 0 ? null : major;
};

/** The facts that decide whether `angularToAngularVite` applies; its check adds the warnings. */
const inspectMigration = async (
  packageManager: JsPackageManager,
  mainConfig: StorybookConfigRaw
) => {
  const allDeps = packageManager.getAllDependencies();

  if (allDeps[ANGULAR_VITE_PACKAGE] || MIGRATABLE_FRAMEWORKS.every((pkg) => !allDeps[pkg])) {
    return null;
  }

  const angularSpecifier = await packageManager.getDeclaredVersionSpecifier('@angular/core');
  // `@analogjs/storybook-angular` declares `@storybook/angular` as its peer, so the dependency
  // alone does not say which framework the project renders with, and a framework this migration
  // cannot rewrite would come out a half-migrated hybrid. Only the `framework` field decides.
  const frameworkPackageName = getFrameworkPackageName(mainConfig);
  return {
    angularSpecifier,
    frameworkPackageName,
    framework: matchMigratableFramework(frameworkPackageName),
    angularMajor: getGuaranteedAngularMajor(angularSpecifier),
  };
};

/** Whether `angularToAngularVite` is offered to this project. */
export const offersAngularViteMigration = async (
  packageManager: JsPackageManager,
  mainConfig: StorybookConfigRaw
) => {
  const migration = await inspectMigration(packageManager, mainConfig);
  return (
    !!migration?.framework &&
    (migration.angularMajor === null || migration.angularMajor >= ANGULAR_MIN_MAJOR)
  );
};

export const angularToAngularVite: Fix<AngularToAngularViteOptions> = {
  id: 'angular-to-angular-vite',
  link: FRAMEWORK_DOC_URL,
  defaultSelected: false,

  async check({
    files,
    packageManager,
    mainConfig,
    mainConfigPath,
  }): Promise<AngularToAngularViteOptions | null> {
    const migration = await inspectMigration(packageManager, mainConfig);
    if (!migration) {
      return null;
    }

    const { angularSpecifier, frameworkPackageName, framework, angularMajor } = migration;
    if (!framework) {
      if (angularSpecifier) {
        logger.warn(
          `Skipped ${ANGULAR_VITE_PACKAGE} migration: this project's Storybook framework is ` +
            `\`${frameworkPackageName ?? 'not set'}\`, and only ` +
            `${MIGRATABLE_FRAMEWORKS.map((pkg) => `\`${pkg}\``).join(' and ')} projects can be ` +
            `migrated automatically. See ${FRAMEWORK_DOC_URL} to switch frameworks by hand.`
        );
      }
      return null;
    }

    if (angularMajor !== null && angularMajor < ANGULAR_MIN_MAJOR) {
      logger.warn(
        `Skipped ${ANGULAR_VITE_PACKAGE} migration: it needs Angular ${ANGULAR_MIN_MAJOR}, and ` +
          `this project is on Angular ${angularMajor}. Run \`ng update @angular/core @angular/cli\` ` +
          `to upgrade, then run this migration again.`
      );
      return null;
    }
    if (angularMajor === null) {
      logger.warn(
        `Could not determine the \`@angular/core\` version, so the ${ANGULAR_VITE_PACKAGE} ` +
          `migration cannot confirm this project is on Angular ${ANGULAR_MIN_MAJOR} or newer. ` +
          `Continuing anyway. If the migrated project fails to build, upgrade Angular first.`
      );
    }

    const workspaceJson = await Promise.all(
      (await findWorkspaceJsonFiles(packageManager.packageJsonPaths, ['angular.json'])).map(
        (path) => readJsonFile(files, path)
      )
    );

    return {
      framework,
      hasWebpackFinal:
        !!mainConfigPath && (await files.read(mainConfigPath)).includes('webpackFinal'),
      angularVersion: angularMajor === null ? null : angularSpecifier,
      zoneJs: resolveZoneJs(workspaceJson, packageManager.isDependencyInstalled('zone.js')),
    };
  },

  prompt() {
    return 'Migrate from @storybook/angular (Webpack) or @analogjs/storybook-angular to @storybook/angular-vite (in preview).';
  },

  transform: ({ result }) => [
    {
      filter: { kind: ['main'] },
      // Only `@storybook/angular` is a prefix of `@storybook/angular-vite`, so only it needs the
      // negative lookahead that leaves already-migrated references alone.
      handler: (code) =>
        result.framework === ANGULAR_PACKAGE
          ? code.replace(/@storybook\/angular(?!-vite)/g, ANGULAR_VITE_PACKAGE)
          : code.replaceAll(result.framework, ANGULAR_VITE_PACKAGE),
    },
    ...compodocTransforms(),
    ...(result.zoneJs === 'import' ? [addZoneJsImport] : []),
    {
      filter: { kind: ['main', 'preview', 'manager', 'config', 'story'] },
      handler: (code) => transformImports(code, IMPORT_RENAMES),
    },
  ],

  async run({
    result,
    files,
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    configDir,
    packageManager,
    storybookVersion,
    yes,
    addonsToPostinstall,
  }) {
    if (result.hasWebpackFinal) {
      logger.logBox(
        dedent`
          We detected a \`webpackFinal\` hook in your Storybook main config.

          \`webpackFinal\` is a Webpack-specific API and will not carry over to Vite.
          You will need to port it to \`viteFinal\` after the migration.
          See ${VITE_CONFIG_DOC_URL} for porting guidance.
        `
      );

      const shouldContinue =
        !yes &&
        (await prompt.confirm({
          message: 'I detected a webpackFinal hook. It will not carry over. Continue anyway?',
          initialValue: false,
        }));

      if (!shouldContinue) {
        logger.log(
          'Migration cancelled. Port your webpackFinal hook to viteFinal first, then run the automigration again.'
        );
        return false;
      }
    }

    logger.debug(`Migrating from ${result.framework} to ${ANGULAR_VITE_PACKAGE}...`);

    await assertMainConfigNamesFramework(files, mainConfigPath, result.framework, {
      from: result.framework,
      to: ANGULAR_VITE_PACKAGE,
    });

    // Everything that can fail runs before the first dependency change or `add()`.
    const changedPaths = await rewriteWorkspaceJson(
      files,
      await findWorkspaceJsonFiles(packageManager.packageJsonPaths, ['angular.json'])
    );
    changedPaths.forEach((path) => logger.debug(`Updated Storybook builder references in ${path}`));

    // `angular-vite-remove-compodoc` cannot do this: every fix is checked against the main config
    // as it stood before this run switched the framework.
    const compodocSetup = await findCompodocSetup({
      files,
      mainConfig,
      previewConfigPath,
      packageManager,
      builderPackages: [ANGULAR_VITE_PACKAGE, ...MIGRATABLE_FRAMEWORKS],
    });

    const wantsVitest =
      yes ||
      (await prompt.confirm({
        message:
          'Set up @storybook/addon-vitest? (Recommended — enables in-browser component tests with Vitest)',
        initialValue: true,
      }));

    if (wantsVitest) {
      // The deferred addon-vitest postinstall updates an existing Vite or Vitest config, and skips
      // this one because it is already wired.
      const hasViteConfig = find.any(VITE_CONFIG_FILES, { last: getProjectRoot(), cwd: configDir });
      if (!hasViteConfig) {
        const newConfigFile = resolve(dirname(configDir), 'vitest.config.ts');
        files.write(
          newConfigFile,
          await formatFileContent(
            newConfigFile,
            buildAngularVitestConfig(relative(dirname(newConfigFile), configDir))
          )
        );
        logger.debug(`Creating a Vitest config file: ${newConfigFile}`);
      }

      // The addon is not installed until the end of the run, so its postinstall is deferred.
      await add(
        '@storybook/addon-vitest',
        {
          packageManager: packageManager.type,
          configDir,
          skipInstall: true,
          skipPostinstall: true,
          yes: !!yes,
        },
        automigrationLogger
      );
      addonsToPostinstall?.push('@storybook/addon-vitest');
    }

    const wantsA11y =
      yes ||
      (await prompt.confirm({
        message: 'Set up @storybook/addon-a11y? (Adds accessibility checks to your stories)',
        initialValue: true,
      }));

    if (wantsA11y) {
      await add(
        '@storybook/addon-a11y',
        {
          packageManager: packageManager.type,
          configDir,
          skipInstall: true,
          skipPostinstall: true,
          yes: !!yes,
        },
        automigrationLogger
      );
    }

    // `@analogjs/storybook-angular` declares `@storybook/angular` as a peer, so an Analog project
    // carries both and neither renders anything once the framework points at angular-vite.
    await packageManager.removeDependencies(
      result.framework === ANALOG_PACKAGE ? [ANALOG_PACKAGE, ANGULAR_PACKAGE] : [ANGULAR_PACKAGE]
    );

    const allDeps = packageManager.getAllDependencies();
    const { angularVersion } = result;
    const angularPeers = [
      ANGULAR_BUILD_PACKAGE,
      ANGULAR_ANIMATIONS_PACKAGE,
      ANGULAR_DEVKIT_ARCHITECT_PACKAGE,
    ].filter((pkg) => !allDeps[pkg]);

    if (!angularVersion && angularPeers.length > 0) {
      logger.warn(
        `Could not determine the \`@angular/core\` version, so ` +
          `${angularPeers.map((pkg) => `\`${pkg}\``).join(', ')} were not added. ` +
          `${ANGULAR_VITE_PACKAGE} needs them at your Angular version, and adding them ` +
          `unpinned would install the next Angular major. Add them by hand before starting ` +
          `Storybook.`
      );
    }

    await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
      `${ANGULAR_VITE_PACKAGE}@${storybookVersion}`,
      ...(allDeps[ANALOG_VITE_PLUGIN_PACKAGE]
        ? []
        : [`${ANALOG_VITE_PLUGIN_PACKAGE}@${ANALOG_VITE_PLUGIN_ANGULAR_VERSION}`]),
      ...(angularVersion
        ? angularPeers.map(
            (pkg) =>
              // `@angular-devkit/architect` numbers itself `0.<major * 100 + minor>.<patch>`.
              `${pkg}@${pkg === ANGULAR_DEVKIT_ARCHITECT_PACKAGE ? toDevkitVersion(angularVersion) : angularVersion}`
          )
        : []),
    ]);

    // `JsPackageManager` caches package.json process-wide, so a raw write would be undone by the
    // next `addDependencies`.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const content = await files.read(pkgJsonPath);
      // The @storybook/test-runner flow does not carry over to angular-vite.
      const transformed = rewriteBuilderRefs(content).replace(
        /("test-storybook"\s*:\s*)"(?:[^"\\]|\\.)*"/,
        '$1"vitest run"'
      );
      if (transformed !== content) {
        packageManager.writePackageJson(JSON.parse(transformed), dirname(pkgJsonPath));
        logger.debug(`Updated builder references and scripts in ${pkgJsonPath}`);
      }
    }

    if (compodocSetup) {
      await removeCompodocSetup({ result: compodocSetup, files, packageManager });
    }

    if (result.zoneJs === 'missing') {
      logger.warn(
        'A Storybook builder target sets `zoneless: false`, but this project does not depend on ' +
          "`zone.js`, so no `import 'zone.js';` was added to your preview - it could not resolve, " +
          'and every story would fail to load. Install `zone.js`, or set `zoneless: true` on that ' +
          'target if your app uses zoneless change detection.'
      );
    }
    if (result.zoneJs === 'import' && !previewConfigPath) {
      logger.warn(
        "Could not find a Storybook preview file to add the zone.js import to. If your app uses zone-based change detection, add `import 'zone.js';` at the top of your preview file manually."
      );
    }
  },
};
