import { existsSync } from 'node:fs';

import { types as t } from 'storybook/internal/babel';
import {
  ANALOG_VITE_PLUGIN_ANGULAR_VERSION,
  editJsonText,
  isStorybookTarget,
  type JSONEditPath,
  type StorybookBuilderTarget,
  toDevkitVersion,
} from 'storybook/internal/cli';
import { formatFileContent, getProjectRoot, transformImports } from 'storybook/internal/common';
import { formatConfig, loadConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { dirname, relative, resolve } from 'pathe';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import type { FixFiles } from '../fix-files.ts';
import { getFrameworkPackageName } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';
import {
  findWorkspaceFiles,
  getTargetGroups,
  type AngularTargetGroup,
} from './angular-workspace.ts';
import { findCompodocSetup, removeCompodocSetup } from './angular-vite-remove-compodoc.ts';

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
  /** The framework the project renders with today, and the one every rewrite below keys off. */
  framework: MigratableFramework;
  angularVersion: string | null;
  /** True when the main config contains a webpackFinal hook. */
  hasWebpackFinal: boolean;
  /** package.json paths that reference @storybook/angular. */
  packageJsonFiles: string[];
}

/**
 * Replace @storybook/angular builder references in a JSON file. Handles both
 * `angular.json` architect entries and `package.json` scripts.
 */
const rewriteBuilderRefs = (content: string): string =>
  MIGRATABLE_FRAMEWORKS.reduce(
    (acc, framework) =>
      acc
        .replaceAll(`${framework}:start-storybook`, `${ANGULAR_VITE_PACKAGE}:start-storybook`)
        .replaceAll(`${framework}:build-storybook`, `${ANGULAR_VITE_PACKAGE}:build-storybook`),
    content
  );

/**
 * Repoint an existing `test-storybook` package.json script at standalone Vitest. The
 * @storybook/test-runner flow does not carry over to @storybook/angular-vite, so the script should
 * run `vitest run` directly. No-ops when the script is absent, and is idempotent (rewriting an
 * already-`vitest run` value yields the same string).
 */
const rewriteTestStorybookScript = (content: string): string =>
  content.replace(/("test-storybook"\s*:\s*)"(?:[^"\\]|\\.)*"/, '$1"vitest run"');

// Config file basenames whose presence means a Vite/Vitest setup already exists, so the migration
// must not write a fresh `vitest.config.ts` over it — the deferred addon-vitest postinstall
// updates the existing file instead.
const VITE_CONFIG_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

/**
 * Find an existing Vite/Vitest config by searching from the Storybook config dir up to the project
 * root, mirroring the addon-vitest postinstall's lookup. Returns the first match, or `undefined`
 * when none exists.
 */
const findExistingViteConfig = (configDir: string): string | undefined => {
  const search = (basename: string, extensions: string[]) =>
    find.any(
      extensions.map((ext) => basename + ext),
      { last: getProjectRoot(), cwd: configDir }
    );

  return (
    search('vite.config', VITE_CONFIG_EXTENSIONS) || search('vitest.config', VITE_CONFIG_EXTENSIONS)
  );
};

/**
 * A standalone `vitest.config.ts` for Angular projects. The nested `plugins` array carries
 * `storybookAngularVitest()` ahead of `storybookTest()` so standalone `vitest` runs receive the
 * Angular build options (styles, assets, zoneless, …) — both must live in the same array.
 * `configDirRelative` is the path from this file's directory to the Storybook config dir.
 */
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

interface JsonTargetTransformResult {
  hasStorybookTarget: boolean;
  /** True when at least one storybook target explicitly declares `zoneless: false`. */
  anyZoneBasedTarget: boolean;
}

/** Map a migratable builder/executor ref to its angular-vite equivalent, or `null` if unrelated. */
const rewriteStorybookBuilderRef = (ref: string): string | null => {
  for (const framework of MIGRATABLE_FRAMEWORKS) {
    if (ref === `${framework}:start-storybook`) {
      return `${ANGULAR_VITE_PACKAGE}:start-storybook`;
    }
    if (ref === `${framework}:build-storybook`) {
      return `${ANGULAR_VITE_PACKAGE}:build-storybook`;
    }
  }
  return null;
};

/** Whether `target` runs Storybook through a framework this migration can rewrite. */
const isMigratableStorybookTarget = (target: unknown): target is StorybookBuilderTarget =>
  MIGRATABLE_FRAMEWORKS.some((framework) => isStorybookTarget(target, framework));

/**
 * Resolve what `main.ts` names as its framework to one this migration can rewrite.
 *
 * `getFrameworkPackageName` maps a resolved path back to a package name only for frameworks
 * Storybook itself ships, so a third-party one like `@analogjs/storybook-angular` arrives as
 * whatever `getAbsolutePath()` returned: the installed package directory, or a pnpm virtual-store
 * dir that spells the scope slash as `+`.
 */
const matchMigratableFramework = (
  frameworkPackageName: string | null
): MigratableFramework | undefined => {
  if (!frameworkPackageName) {
    return undefined;
  }
  const normalized = frameworkPackageName.replace(/\\/g, '/');
  return MIGRATABLE_FRAMEWORKS.find(
    (framework) =>
      normalized === framework ||
      // `@storybook/angular` must not match a path ending in `@storybook/angular-vite`, which the
      // leading slash guarantees.
      normalized.endsWith(`/${framework}`) ||
      normalized.includes(`/.pnpm/${framework.replace('/', '+')}@`)
  );
};

/** Accumulates sequential `editJsonText` edits against an in-memory string. */
class TextJsonEditor {
  content: string;

  constructor(content: string) {
    this.content = content;
  }

  edit(path: JSONEditPath, value: unknown): void {
    this.content = editJsonText(this.content, path, value);
  }
}

/**
 * Rewrite builder/executor references and rename any leftover `experimentalZoneless` key to
 * `zoneless`, across every storybook target in `targetGroups`, reporting whether any of them
 * explicitly opts out of zoneless change detection.
 */
const processStorybookTargets = (
  editor: TextJsonEditor,
  targetGroups: AngularTargetGroup[]
): JsonTargetTransformResult => {
  let hasStorybookTarget = false;
  let anyZoneBasedTarget = false;

  for (const { pathPrefix, targets } of targetGroups) {
    for (const [targetName, target] of Object.entries(targets)) {
      // Detection is wider than the rewrite: a multi-project upgrade runs each project against the
      // tree the first project already rewrote, and a narrower gate would report no Storybook
      // target at all and skip the zone.js injection.
      if (
        !isMigratableStorybookTarget(target) &&
        !isStorybookTarget(target, ANGULAR_VITE_PACKAGE)
      ) {
        continue;
      }
      hasStorybookTarget = true;

      const currentRef = target.builder ?? target.executor ?? null;
      const hasOldZonelessKey = !!target.options && 'experimentalZoneless' in target.options;
      // An earlier run may already have renamed the key, so both spellings count.
      const zonelessValue = target.options?.zoneless ?? target.options?.experimentalZoneless;

      if (zonelessValue === false) {
        anyZoneBasedTarget = true;
      }

      if (!isMigratableStorybookTarget(target)) {
        continue;
      }

      const newRef = currentRef ? rewriteStorybookBuilderRef(currentRef) : null;
      if (newRef) {
        const refKey = 'builder' in target ? 'builder' : 'executor';
        editor.edit([...pathPrefix, targetName, refKey], newRef);
      }

      if (hasOldZonelessKey) {
        editor.edit([...pathPrefix, targetName, 'options', 'zoneless'], zonelessValue);
        editor.edit([...pathPrefix, targetName, 'options', 'experimentalZoneless'], undefined);
      }
    }
  }

  return { hasStorybookTarget, anyZoneBasedTarget };
};

/**
 * Rewrite the Storybook targets of `angular.json` or Nx `project.json` files, and report what the
 * rewritten targets declare.
 */
const transformWorkspaceJson = async (
  files: FixFiles,
  paths: string[]
): Promise<JsonTargetTransformResult & { changedPaths: string[] }> => {
  let hasStorybookTarget = false;
  let anyZoneBasedTarget = false;
  const changedPaths = await files.edit(paths, (source) => {
    const editor = new TextJsonEditor(source);
    const result = processStorybookTargets(editor, getTargetGroups(JSON.parse(source)));
    hasStorybookTarget ||= result.hasStorybookTarget;
    anyZoneBasedTarget ||= result.anyZoneBasedTarget;
    return editor.content;
  });
  return { hasStorybookTarget, anyZoneBasedTarget, changedPaths };
};

const addZoneJsPreviewImport = async (files: FixFiles, previewConfigPath: string) => {
  const changed = await files.edit(previewConfigPath, (source) => {
    const preview = loadConfig(source, previewConfigPath).parse();

    // Leave an existing zone.js import (incl. subpaths like zone.js/testing) alone.
    const hasZoneJsImport = preview._ast.program.body.some(
      (node) =>
        t.isImportDeclaration(node) &&
        typeof node.source.value === 'string' &&
        (node.source.value === 'zone.js' || node.source.value.startsWith('zone.js/'))
    );
    if (hasZoneJsImport) {
      return;
    }

    preview.setImport(null, 'zone.js');
    return formatFileContent(previewConfigPath, formatConfig(preview));
  });
  if (changed.length > 0) {
    logger.step(`Added a \`zone.js\` import to ${previewConfigPath}`);
  }
};

const getGuaranteedAngularMajor = (specifier: string | null): number | null => {
  const range = specifier ? semver.validRange(specifier) : null;
  const major = range ? (semver.minVersion(range)?.major ?? null) : null;
  return major === 0 ? null : major;
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
    const allDeps = packageManager.getAllDependencies();

    // Only apply when a migratable framework is present and @storybook/angular-vite is not.
    if (allDeps[ANGULAR_VITE_PACKAGE] || MIGRATABLE_FRAMEWORKS.every((pkg) => !allDeps[pkg])) {
      return null;
    }

    const angularSpecifier = await packageManager.getDeclaredVersionSpecifier('@angular/core');

    // `@analogjs/storybook-angular` declares `@storybook/angular` as its peer, so the dependency
    // alone does not say which framework the project renders with, and a framework this migration
    // cannot rewrite would come out a half-migrated hybrid. Only the `framework` field decides.
    const frameworkPackageName = getFrameworkPackageName(mainConfig);
    const framework = matchMigratableFramework(frameworkPackageName);
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

    const angularMajor = getGuaranteedAngularMajor(angularSpecifier);
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

    const hasWebpackFinal =
      !!mainConfigPath && (await files.read(mainConfigPath)).includes('webpackFinal');

    // Collect package.json files that reference a migratable framework.
    const packageJsonFiles: string[] = [];
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const raw = await files.read(pkgJsonPath);
        const pkg = JSON.parse(raw);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (MIGRATABLE_FRAMEWORKS.some((pkg) => pkg in deps)) {
          packageJsonFiles.push(pkgJsonPath);
        }
      } catch {
        continue;
      }
    }

    return {
      framework,
      hasWebpackFinal,
      packageJsonFiles,
      angularVersion: angularMajor === null ? null : angularSpecifier,
    };
  },

  prompt() {
    return 'Migrate from @storybook/angular (Webpack) or @analogjs/storybook-angular to @storybook/angular-vite (in preview).';
  },

  async run({
    result,
    files,
    mainConfig,
    mainConfigPath,
    previewConfigPath,
    storiesPaths,
    configDir,
    packageManager,
    storybookVersion,
    yes,
    addonsToPostinstall,
  }) {
    // When webpackFinal is present, warn prominently and ask whether to continue.
    if (result.hasWebpackFinal) {
      logger.logBox(
        dedent`
          We detected a \`webpackFinal\` hook in your Storybook main config.

          \`webpackFinal\` is a Webpack-specific API and will not carry over to Vite.
          You will need to port it to \`viteFinal\` after the migration.
          See ${VITE_CONFIG_DOC_URL} for porting guidance.
        `
      );

      const shouldContinue = yes
        ? false
        : await prompt.confirm({
            message: 'I detected a webpackFinal hook. It will not carry over. Continue anyway?',
            initialValue: false,
          });

      if (!shouldContinue) {
        logger.log(
          'Migration cancelled. Port your webpackFinal hook to viteFinal first, then run the automigration again.'
        );
        return;
      }
    }

    logger.step(`Migrating from ${result.framework} to ${ANGULAR_VITE_PACKAGE}...`);

    // Everything below assumes the framework already says angular-vite: `check()` reads it off the
    // evaluated config, so the field can be inherited from a shared base file instead.
    if (!(await files.read(mainConfigPath)).includes(result.framework)) {
      throw new Error(dedent`
        The \`framework\` field could not be rewritten in ${mainConfigPath}.
        That file names no \`${result.framework}\`, so it most likely inherits the framework from a shared config.
        Point \`framework\` at \`${ANGULAR_VITE_PACKAGE}\` where it is declared, then run this migration again.
      `);
    }

    // `add()` rewrites the main and preview configs on disk, so it runs before any edit of them is
    // staged: committing a staged edit would overwrite what it wrote.
    const wantsVitest = yes
      ? true
      : await prompt.confirm({
          message:
            'Set up @storybook/addon-vitest? (Recommended — enables in-browser component tests with Vitest)',
          initialValue: true,
        });

    if (wantsVitest) {
      // Create a standalone vitest.config.ts (already wired with storybookAngularVitest) when the
      // project has no Vite/Vitest config yet. The deferred addon-vitest postinstall is
      // idempotent: it detects this fully-wired config and skips, and updates an existing config
      // when one is found, so we only create the file here, never overwrite.
      if (!findExistingViteConfig(configDir)) {
        const newConfigFile = resolve(dirname(configDir), 'vitest.config.ts');
        const configDirRelative = relative(dirname(newConfigFile), configDir);
        files.write(
          newConfigFile,
          await formatFileContent(newConfigFile, buildAngularVitestConfig(configDirRelative))
        );
        logger.step(`Creating a Vitest config file: ${newConfigFile}`);
      }

      // Add to package.json + main.ts now, but defer the postinstall: dependencies are
      // installed in a single batch at the end of automigrate, so the addon isn't on disk
      // yet and its postinstall hook can't be resolved here. The runner configures it after
      // install (see `addonsToPostinstall`), mirroring CLI init's install-then-configure order.
      await add('@storybook/addon-vitest', {
        packageManager: packageManager.type,
        configDir,
        skipInstall: true,
        skipPostinstall: true,
        yes: !!yes,
      });
      addonsToPostinstall?.push('@storybook/addon-vitest');
    }

    const wantsA11y = yes
      ? true
      : await prompt.confirm({
          message: 'Set up @storybook/addon-a11y? (Adds accessibility checks to your stories)',
          initialValue: true,
        });

    if (wantsA11y) {
      // Deferred postinstall, same as addon-vitest above.
      await add('@storybook/addon-a11y', {
        packageManager: packageManager.type,
        configDir,
        skipInstall: true,
        skipPostinstall: true,
        yes: !!yes,
      });
      addonsToPostinstall?.push('@storybook/addon-a11y');
    }

    // Only `@storybook/angular` is a prefix of `@storybook/angular-vite`, so only it needs the
    // negative lookahead that leaves already-migrated references alone.
    await files.edit(mainConfigPath, (source) =>
      result.framework === ANGULAR_PACKAGE
        ? source.replace(/@storybook\/angular(?!-vite)/g, ANGULAR_VITE_PACKAGE)
        : source.replaceAll(result.framework, ANGULAR_VITE_PACKAGE)
    );

    // `@analogjs/storybook-angular` declares `@storybook/angular` as a peer, so an Analog project
    // carries both and neither renders anything once the framework points at angular-vite.
    await packageManager.removeDependencies(
      result.framework === ANALOG_PACKAGE ? [ANALOG_PACKAGE, ANGULAR_PACKAGE] : [ANGULAR_PACKAGE]
    );

    const allDeps = packageManager.getAllDependencies();
    const { angularVersion } = result;
    // `@angular-devkit/architect` numbers itself `0.<major * 100 + minor>.<patch>`, so it cannot
    // take the Angular range unchanged.
    const architectVersion = toDevkitVersion(angularVersion);

    const unpinnableAngularPeers = angularVersion
      ? []
      : [
          ANGULAR_BUILD_PACKAGE,
          ANGULAR_ANIMATIONS_PACKAGE,
          ANGULAR_DEVKIT_ARCHITECT_PACKAGE,
        ].filter((pkg) => !allDeps[pkg]);

    if (unpinnableAngularPeers.length > 0) {
      logger.warn(
        `Could not determine the \`@angular/core\` version, so ` +
          `${unpinnableAngularPeers.map((pkg) => `\`${pkg}\``).join(', ')} were not added. ` +
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
      ...(allDeps[ANGULAR_BUILD_PACKAGE] || !angularVersion
        ? []
        : [`${ANGULAR_BUILD_PACKAGE}@${angularVersion}`]),
      ...(allDeps[ANGULAR_ANIMATIONS_PACKAGE] || !angularVersion
        ? []
        : [`${ANGULAR_ANIMATIONS_PACKAGE}@${angularVersion}`]),
      ...(allDeps[ANGULAR_DEVKIT_ARCHITECT_PACKAGE] || !architectVersion
        ? []
        : [`${ANGULAR_DEVKIT_ARCHITECT_PACKAGE}@${architectVersion}`]),
    ]);

    // Nx workspaces scatter `project.json` files (e.g. `libs/*/project.json`) away from
    // `package.json` and use `executor` rather than angular.json's `builder`; the
    // `@storybook/angular:<target>` string is identical, so the same rewrite applies.
    const angularJsonPaths = packageManager.packageJsonPaths
      .map((pkgJsonPath) => pkgJsonPath.replace(/[/\\]package\.json$/, '/angular.json'))
      .filter((path) => existsSync(path));
    const { hasStorybookTarget, anyZoneBasedTarget, changedPaths } = await transformWorkspaceJson(
      files,
      [...angularJsonPaths, ...(await findWorkspaceFiles('project.json'))]
    );
    changedPaths.forEach((path) => logger.debug(`Updated Storybook builder references in ${path}`));

    // Rewrite builder references and the `test-storybook` script in package.json.
    // The write goes through the package manager: it reads package.json from a process-wide cache
    // that a raw write cannot invalidate, so a later `addDependencies` would undo this one.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const content = await files.read(pkgJsonPath);
      const transformed = rewriteTestStorybookScript(rewriteBuilderRefs(content));
      if (transformed !== content) {
        packageManager.writePackageJson(JSON.parse(transformed), dirname(pkgJsonPath));
        logger.debug(`Updated builder references and scripts in ${pkgJsonPath}`);
      }
    }

    // Drop the Compodoc setup. `@storybook/angular-vite` extracts Angular metadata on the
    // server, so nothing here runs Compodoc or reads its output. The dedicated
    // `angular-vite-remove-compodoc` fix cannot do it: every fix is checked against the main config
    // as it stood when the run started, where the framework is still `@storybook/angular`.
    const compodocSetup = await findCompodocSetup({
      files,
      mainConfig,
      previewConfigPath,
      packageManager,
      builderPackages: [ANGULAR_VITE_PACKAGE, ...MIGRATABLE_FRAMEWORKS],
    });
    if (compodocSetup) {
      await removeCompodocSetup({
        result: compodocSetup,
        files,
        mainConfigPath,
        previewConfigPath,
        packageManager,
      });
    }

    const hasZoneJsDependency = packageManager.isDependencyInstalled('zone.js');

    if (hasStorybookTarget && anyZoneBasedTarget && !hasZoneJsDependency) {
      logger.warn(
        'A Storybook builder target sets `zoneless: false`, but this project does not depend on ' +
          "`zone.js`, so no `import 'zone.js';` was added to your preview - it could not resolve, " +
          'and every story would fail to load. Install `zone.js`, or set `zoneless: true` on that ' +
          'target if your app uses zoneless change detection.'
      );
    }

    const needsZoneJs = hasStorybookTarget && hasZoneJsDependency;
    if (needsZoneJs && previewConfigPath) {
      await addZoneJsPreviewImport(files, previewConfigPath);
    } else if (needsZoneJs && !previewConfigPath) {
      logger.warn(
        "Could not find a Storybook preview file to add the zone.js import to. If your app uses zone-based change detection, add `import 'zone.js';` at the top of your preview file manually."
      );
    }

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const configFiles = await globby([`${configDir}/**/*`]);
    await files.edit([...storiesPaths, ...configFiles], (source) =>
      transformImports(
        source,
        Object.fromEntries(MIGRATABLE_FRAMEWORKS.map((pkg) => [pkg, ANGULAR_VITE_PACKAGE]))
      )
    );

    logger.step('Migration completed successfully!');
    logger.log(`For more information, see: ${FRAMEWORK_DOC_URL}`);
  },
};
