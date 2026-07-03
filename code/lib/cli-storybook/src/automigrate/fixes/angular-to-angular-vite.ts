import { readFile, writeFile } from 'node:fs/promises';

import { types as t } from 'storybook/internal/babel';
import { formatFileContent, getProjectRoot, transformImportFiles } from 'storybook/internal/common';
import { type ConfigFile, readConfig } from 'storybook/internal/csf-tools';
import { logger, prompt } from 'storybook/internal/node-logger';

import * as find from 'empathic/find';
import { dirname, relative, resolve } from 'pathe';
import semver from 'semver';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

export const ANGULAR_PACKAGE = '@storybook/angular';
export const ANGULAR_VITE_PACKAGE = '@storybook/angular-vite';

const FRAMEWORK_DOC_URL = 'https://storybook.js.org/docs/get-started/frameworks/angular-vite';
const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

interface AngularToAngularViteOptions {
  /** True when @angular/core is not found or is outside the 21.x range. */
  angularUnsupportedVersion: boolean;
  /** The detected @angular/core version string, or null if not found. */
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
  content
    .replace(/@storybook\/angular:start-storybook/g, `${ANGULAR_VITE_PACKAGE}:start-storybook`)
    .replace(/@storybook\/angular:build-storybook/g, `${ANGULAR_VITE_PACKAGE}:build-storybook`);

/**
 * Repoint an existing `test-storybook` package.json script at standalone Vitest. The
 * @storybook/test-runner flow does not carry over to @storybook/angular-vite, so the script should
 * run `vitest run` directly. No-ops when the script is absent, and is idempotent (rewriting an
 * already-`vitest run` value yields the same string).
 */
const rewriteTestStorybookScript = (content: string): string =>
  content.replace(/("test-storybook"\s*:\s*)"(?:[^"\\]|\\.)*"/, '$1"vitest run"');

// Config file basenames whose presence means a Vite/Vitest setup already exists, so the migration
// must not write a fresh `vitest.config.ts` over it — the deferred addon-vitest postinstall updates
// the existing file (and the workspace path) instead.
const VITE_CONFIG_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.cts', '.mts', '.cjs', '.mjs'];

/**
 * Find an existing Vite/Vitest/workspace config by searching from the Storybook config dir up to the
 * project root, mirroring the addon-vitest postinstall's lookup. Returns the first match, or
 * `undefined` when none exists.
 */
const findExistingViteConfig = (configDir: string): string | undefined => {
  const search = (basename: string, extensions: string[]) =>
    find.any(
      extensions.map((ext) => basename + ext),
      { last: getProjectRoot(), cwd: configDir }
    );

  return (
    search('vitest.workspace', ['.ts', '.js', '.json']) ||
    search('vite.config', VITE_CONFIG_EXTENSIONS) ||
    search('vitest.config', VITE_CONFIG_EXTENSIONS)
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

/**
 * True when the main config's export object has a literal `framework` property followed by an
 * object spread. ConfigFile's `_exports` bookkeeping skips SpreadElement nodes, so
 * `getNameFromPath(['framework'])` resolves the literal even though, per object-literal runtime
 * semantics, a later spread that also sets `framework` silently overrides it.
 */
const hasSpreadAfterFrameworkProperty = (main: ConfigFile): boolean => {
  const properties = main._exportsObject?.properties;
  if (!properties) {
    return false;
  }
  const frameworkIndex = properties.findIndex(
    (property) =>
      t.isObjectProperty(property) &&
      ((t.isIdentifier(property.key) && property.key.name === 'framework') ||
        (t.isStringLiteral(property.key) && property.key.value === 'framework'))
  );
  if (frameworkIndex === -1) {
    return false;
  }
  return properties.slice(frameworkIndex + 1).some((property) => t.isSpreadElement(property));
};

const transformMainConfig = async (mainConfigPath: string, dryRun: boolean): Promise<boolean> => {
  try {
    const content = await readFile(mainConfigPath, 'utf-8');

    if (!content.includes(ANGULAR_PACKAGE)) {
      return false;
    }

    // Replace @storybook/angular with @storybook/angular-vite using a negative
    // lookahead so references that are already @storybook/angular-vite are left alone.
    const transformed = content.replace(/@storybook\/angular(?!-vite)/g, ANGULAR_VITE_PACKAGE);

    if (transformed !== content && !dryRun) {
      await writeFile(mainConfigPath, transformed);
    }

    return transformed !== content;
  } catch (error) {
    logger.error(`Failed to update main config at ${mainConfigPath}: ${error}`);
    return false;
  }
};

/**
 * Detect whether a Storybook builder target in an `angular.json` or Nx
 * `project.json` explicitly disables Compodoc (`options.compodoc: false`).
 * Compodoc now runs only from the framework Vite plugin (default on), so a
 * disabled builder option must be carried into `main.ts` framework.options to
 * preserve intent — otherwise the cold-start default would re-enable it.
 */
const detectDisabledCompodoc = (content: string): boolean => {
  let json: any;
  try {
    json = JSON.parse(content);
  } catch {
    return false;
  }

  const targetDisablesCompodoc = (target: any): boolean => {
    const ref: unknown = target?.builder ?? target?.executor;
    return (
      typeof ref === 'string' &&
      (ref.endsWith(':start-storybook') || ref.endsWith(':build-storybook')) &&
      target?.options?.compodoc === false
    );
  };

  // angular.json: projects.<name>.architect.<target>; project.json: targets.<target>
  const targetGroups: any[] = [];
  if (json?.projects && typeof json.projects === 'object') {
    for (const project of Object.values<any>(json.projects)) {
      targetGroups.push(project?.architect, project?.targets);
    }
  }
  targetGroups.push(json?.targets);

  return targetGroups.some(
    (group) =>
      group && typeof group === 'object' && Object.values<any>(group).some(targetDisablesCompodoc)
  );
};

/**
 * Detect whether an Angular build target in an `angular.json` or Nx `project.json`
 * ships `zone.js` as a polyfill, i.e. the project uses zone-based change detection.
 * @storybook/angular-vite defaults to zoneless outside `ng run`, so this signal is
 * used to re-add the `zone.js` import to the Storybook preview (see step 4c).
 */
const detectUsesZoneJs = (content: string): boolean => {
  let json: any;
  try {
    json = JSON.parse(content);
  } catch {
    return false;
  }

  const isZoneJsPolyfill = (entry: unknown): boolean =>
    typeof entry === 'string' && (entry === 'zone.js' || entry.startsWith('zone.js/'));

  const targetUsesZoneJs = (target: any): boolean => {
    const polyfills = target?.options?.polyfills;
    return Array.isArray(polyfills)
      ? polyfills.some(isZoneJsPolyfill)
      : isZoneJsPolyfill(polyfills);
  };

  // angular.json: projects.<name>.architect.<target>; project.json: targets.<target>
  const targetGroups: any[] = [];
  if (json?.projects && typeof json.projects === 'object') {
    for (const project of Object.values<any>(json.projects)) {
      targetGroups.push(project?.architect, project?.targets);
    }
  }
  targetGroups.push(json?.targets);

  return targetGroups.some(
    (group) =>
      group && typeof group === 'object' && Object.values<any>(group).some(targetUsesZoneJs)
  );
};

const transformJsonFile = async (
  filePath: string,
  dryRun: boolean
): Promise<{ changed: boolean; disablesCompodoc: boolean; usesZoneJs: boolean }> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    const transformed = rewriteBuilderRefs(content);
    const changed = transformed !== content;

    if (changed && !dryRun) {
      await writeFile(filePath, transformed);
    }

    return {
      changed,
      disablesCompodoc: detectDisabledCompodoc(content),
      usesZoneJs: detectUsesZoneJs(content),
    };
  } catch {
    return { changed: false, disablesCompodoc: false, usesZoneJs: false };
  }
};

/**
 * Prepend `import 'zone.js';` to the Storybook preview when the migrated project uses
 * zone-based change detection. The Webpack `@storybook/angular` builder loaded zone.js
 * from the Angular build `polyfills`; @storybook/angular-vite defaults to zoneless
 * outside `ng run`, so without this the polyfill is dropped for `storybook dev`,
 * `storybook build`, and standalone Vitest, breaking `NgZone`-dependent stories.
 * Idempotent, and a no-op in dry runs.
 */
const addZoneJsPreviewImport = async (
  previewConfigPath: string,
  dryRun: boolean
): Promise<void> => {
  try {
    const content = await readFile(previewConfigPath, 'utf-8');

    // Leave an existing zone.js import (any quote style, incl. subpaths) alone.
    if (/import\s+['"]zone\.js(\/[^'"]*)?['"]/.test(content)) {
      return;
    }

    if (dryRun) {
      return;
    }

    // zone.js must be imported before Angular loads, so it goes at the very top.
    await writeFile(previewConfigPath, `import 'zone.js';\n${content}`);
    logger.step(`Added a \`zone.js\` import to ${previewConfigPath}`);
  } catch (error) {
    logger.warn(
      `Could not add a \`zone.js\` import to ${previewConfigPath} automatically: ${error}. ` +
        "If your app uses zone-based change detection, add `import 'zone.js';` at the top of your preview."
    );
  }
};

/**
 * Set `framework.options.compodoc` to `false` in main config, preserving the framework name.
 *
 * `framework` can take three shapes, and each needs different handling so the name survives:
 *
 * - Bare string: `framework: '@storybook/angular-vite'`
 * - Wrapped call: `framework: getAbsolutePath('@storybook/angular-vite')`
 * - Object form: `framework: { name: ..., options: {...} }`
 *
 * For the string and call-expression shapes, a nested `setFieldValue(['framework', 'options',
 * 'compodoc'], false)` would replace the whole `framework` value, dropping the name (e.g. producing
 * `framework: { options: { compodoc: false } }`). So we operate on the AST node directly and wrap
 * the original node as `name`, which preserves a `getAbsolutePath(...)` call verbatim. The object
 * shape (inline or referenced via a variable) is already nestable, so the nested set is correct.
 */
export const setFrameworkCompodocFalse = (main: ConfigFile): void => {
  const frameworkNode = main.getFieldNode(['framework']);

  if (frameworkNode && (t.isStringLiteral(frameworkNode) || t.isCallExpression(frameworkNode))) {
    main.setFieldNode(
      ['framework'],
      t.objectExpression([
        t.objectProperty(t.identifier('name'), frameworkNode),
        t.objectProperty(
          t.identifier('options'),
          t.objectExpression([t.objectProperty(t.identifier('compodoc'), t.booleanLiteral(false))])
        ),
      ])
    );
    return;
  }

  // Object form (inline or via a variable reference): keep the existing name and options.
  main.setFieldValue(['framework', 'options', 'compodoc'], false);
};

export const angularToAngularVite: Fix<AngularToAngularViteOptions> = {
  id: 'angular-to-angular-vite',
  link: FRAMEWORK_DOC_URL,
  defaultSelected: false,

  async check({ packageManager }): Promise<AngularToAngularViteOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    // Only apply when @storybook/angular is present and @storybook/angular-vite is not.
    if (!allDeps[ANGULAR_PACKAGE] || allDeps[ANGULAR_VITE_PACKAGE]) {
      return null;
    }

    // Detect @angular/core version for the Angular 21 prerequisite check.
    const angularVersionRaw = packageManager.getDependencyVersion('@angular/core');
    const angularVersion = angularVersionRaw
      ? (semver.coerce(angularVersionRaw)?.version ?? null)
      : null;
    const angularUnsupportedVersion =
      !angularVersion || !semver.satisfies(angularVersion, '>=21.0.0');

    // Detect webpackFinal in main config by scanning package.json paths for the
    // config dir, then reading main config content.
    let hasWebpackFinal = false;
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      // Look for main config files adjacent to the package.json
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      for (const mainName of [
        `${dir}/.storybook/main.ts`,
        `${dir}/.storybook/main.js`,
        `${dir}/.storybook/main.mts`,
        `${dir}/.storybook/main.mjs`,
      ]) {
        try {
          const content = await readFile(mainName, 'utf-8');
          if (content.includes('webpackFinal')) {
            hasWebpackFinal = true;
          }
          break;
        } catch {
          continue;
        }
      }
      if (hasWebpackFinal) {
        break;
      }
    }

    // Collect package.json files that reference @storybook/angular.
    const packageJsonFiles: string[] = [];
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const raw = await readFile(pkgJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (Object.keys(deps).includes(ANGULAR_PACKAGE)) {
          packageJsonFiles.push(pkgJsonPath);
        }
      } catch {
        continue;
      }
    }

    return {
      angularUnsupportedVersion,
      angularVersion,
      hasWebpackFinal,
      packageJsonFiles,
    };
  },

  prompt() {
    return 'Migrate from @storybook/angular (Webpack) to @storybook/angular-vite (in preview).';
  },

  async run({
    result,
    dryRun = false,
    mainConfigPath,
    previewConfigPath,
    storiesPaths,
    configDir,
    packageManager,
    storybookVersion,
    yes,
    addonsToPostinstall,
  }) {
    if (!result) {
      return;
    }

    // Hard bail if Angular version is unsupported — the prompt already told the user what to do.
    if (result.angularUnsupportedVersion) {
      logger.log(
        dedent`
          Migration skipped: Angular 21 is required.
          Run \`ng update @angular/core @angular/cli\` to upgrade, then try again.
        `
      );
      return;
    }

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

    logger.step(`Migrating from ${ANGULAR_PACKAGE} to ${ANGULAR_VITE_PACKAGE}...`);

    // 1. Update dependencies.
    if (dryRun) {
      logger.debug('Dry run: Skipping dependency updates.');
    } else {
      logger.debug('Updating dependencies...');
      await packageManager.removeDependencies([ANGULAR_PACKAGE]);
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `${ANGULAR_VITE_PACKAGE}@${storybookVersion}`,
      ]);
    }

    // 2. Patch .storybook/main.ts(.js).
    if (mainConfigPath) {
      logger.debug('Updating main config...');
      await transformMainConfig(mainConfigPath, dryRun);

      // 2b. Guarantee the framework field actually points at @storybook/angular-vite.
      // The text rewrite above only touches frameworks spelled out literally in the
      // main config. When the framework is configured indirectly (e.g. spread from a
      // shared base config in an Nx workspace) the literal `@storybook/angular` string
      // is absent, so nothing is rewritten and the config still resolves to
      // @storybook/angular. That later makes the deferred @storybook/addon-vitest
      // postinstall fail with a confusing "cannot yet be used with angular" error.
      // Read the framework back via AST and, when it doesn't resolve to a literal name,
      // set it explicitly so the migrated project is unambiguously on angular-vite.
      if (!dryRun) {
        try {
          const main = await readConfig(mainConfigPath);
          if (!main.getNameFromPath(['framework'])) {
            await updateMainConfig({ mainConfigPath, dryRun: false }, async (config) => {
              config.setFieldValue(['framework'], ANGULAR_VITE_PACKAGE);
            });
            logger.warn(
              dedent`
                Your Storybook framework looks like it is configured indirectly (not as a literal
                value in ${mainConfigPath}), so it could not be switched automatically.
                We set \`framework: '${ANGULAR_VITE_PACKAGE}'\` for you - please re-apply any framework
                options (e.g. \`compodoc\`) that were previously defined in your shared config.
              `
            );
          } else if (hasSpreadAfterFrameworkProperty(main)) {
            // The literal was rewritten above, but at runtime a later `...spread` wins over an
            // earlier key - so a spread source that also sets `framework` silently undoes the
            // migration. The spread's contents are unknown here, and appending a duplicate
            // literal key is a TypeScript error, so warn instead of force-setting.
            logger.warn(
              dedent`
                The main config at ${mainConfigPath} spreads another object after its \`framework\`
                property. If that spread source also sets \`framework\`, it overrides the migrated
                value at runtime. Verify the shared config does not set \`framework\`, or move the
                \`framework\` property after the spread.
              `
            );
          }
        } catch (error) {
          logger.warn(
            `Could not verify the framework in ${mainConfigPath} automatically: ${error}. ` +
              `Make sure \`framework\` is set to '${ANGULAR_VITE_PACKAGE}'.`
          );
        }
      }
    }

    // Track whether any migrated builder config disabled Compodoc, so the
    // intent can be carried into framework.options (step 4b).
    let disableCompodoc = false;
    // Track whether the project ships zone.js as a build polyfill, so the zone.js
    // import can be re-added to the preview (step 4c).
    let zoneJsNeeded = false;

    // 3. Rewrite Angular CLI builder references in angular.json.
    // Search for angular.json beside every package.json we know about.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      const angularJsonPath = `${dir}/angular.json`;
      const { changed, disablesCompodoc, usesZoneJs } = await transformJsonFile(
        angularJsonPath,
        dryRun
      );
      disableCompodoc ||= disablesCompodoc;
      zoneJsNeeded ||= usesZoneJs;
      if (changed) {
        logger.debug(`Updated Angular CLI builder references in ${angularJsonPath}`);
      }
    }

    // 3b. Rewrite Angular builder references in Nx `project.json` files.
    // Nx workspaces scatter `project.json` files (e.g. `libs/*/project.json`)
    // away from `package.json` and use `executor` rather than angular.json's
    // `builder`; the `@storybook/angular:<target>` string is identical, so the
    // same rewrite applies. Glob the workspace since they are not co-located
    // with package.json the way angular.json is.
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const projectJsonFiles = await globby(['**/project.json'], {
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true,
    });
    for (const projectJsonPath of projectJsonFiles) {
      const { changed, disablesCompodoc, usesZoneJs } = await transformJsonFile(
        projectJsonPath,
        dryRun
      );
      disableCompodoc ||= disablesCompodoc;
      zoneJsNeeded ||= usesZoneJs;
      if (changed) {
        logger.debug(`Updated Nx builder references in ${projectJsonPath}`);
      }
    }

    // 4. Rewrite Angular CLI builder references and the `test-storybook` script in package.json.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const content = await readFile(pkgJsonPath, 'utf-8');
        const transformed = rewriteTestStorybookScript(rewriteBuilderRefs(content));
        if (transformed !== content && !dryRun) {
          await writeFile(pkgJsonPath, transformed);
          logger.debug(`Updated builder references and scripts in ${pkgJsonPath}`);
        }
      } catch {
        continue;
      }
    }

    // 4b. Carry a disabled Compodoc setting into framework.options. Compodoc is
    // now generated only by the framework Vite plugin (default on), so a builder
    // `compodoc: false` must move to main.ts — otherwise the cold-start default
    // would silently re-enable it.
    if (disableCompodoc && mainConfigPath) {
      try {
        await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
          if (dryRun) {
            return;
          }

          setFrameworkCompodocFalse(main);
        });
        logger.debug('Carried `compodoc: false` into framework.options.');
      } catch (error) {
        logger.warn(
          `Could not set \`framework.options.compodoc\` automatically: ${error}. ` +
            "Set `compodoc: false` in your main config's framework.options manually."
        );
      }
    }

    // 4c. Re-add the zone.js import to the preview for zone-based projects. The
    // Webpack builder loaded zone.js from the Angular build `polyfills`, but
    // @storybook/angular-vite defaults to zoneless outside `ng run`, so the polyfill
    // would otherwise be dropped for `storybook dev`, `storybook build`, and Vitest.
    if (zoneJsNeeded && previewConfigPath) {
      await addZoneJsPreviewImport(previewConfigPath, dryRun);
    }

    // 5. Update import statements across config and story files.
    logger.debug('Scanning and updating import statements...');
    const allFiles = [...storiesPaths, mainConfigPath, previewConfigPath].filter(
      Boolean
    ) as string[];

    const transformErrors = await transformImportFiles(
      allFiles,
      { [ANGULAR_PACKAGE]: ANGULAR_VITE_PACKAGE },
      !!dryRun
    );

    if (transformErrors.length > 0) {
      logger.warn(`Encountered ${transformErrors.length} error(s) during file transformation:`);
      transformErrors.forEach(({ file, error }) => {
        logger.warn(`  - ${file}: ${error.message}`);
      });
    }

    // 6. Offer optional addons.
    if (!dryRun) {
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
        // when one is found — so we only create the file here, never overwrite.
        if (configDir && !findExistingViteConfig(configDir)) {
          const newConfigFile = resolve(dirname(configDir), 'vitest.config.ts');
          const configDirRelative = relative(dirname(newConfigFile), configDir);
          const formatted = await formatFileContent(
            newConfigFile,
            buildAngularVitestConfig(configDirRelative)
          );
          await writeFile(newConfigFile, formatted);
          logger.step(`Creating a Vitest config file: ${newConfigFile}`);
        }

        try {
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
        } catch (err) {
          logger.warn(`Could not set up @storybook/addon-vitest automatically: ${err}`);
          logger.warn('Run `npx storybook add @storybook/addon-vitest` manually to set it up.');
        }
      }

      const wantsA11y = yes
        ? true
        : await prompt.confirm({
            message: 'Set up @storybook/addon-a11y? (Adds accessibility checks to your stories)',
            initialValue: true,
          });

      if (wantsA11y) {
        try {
          // Deferred postinstall, same as addon-vitest above.
          await add('@storybook/addon-a11y', {
            packageManager: packageManager.type,
            configDir,
            skipInstall: true,
            skipPostinstall: true,
            yes: !!yes,
          });
          addonsToPostinstall?.push('@storybook/addon-a11y');
        } catch (err) {
          logger.warn(`Could not set up @storybook/addon-a11y automatically: ${err}`);
          logger.warn('Run `npx storybook add @storybook/addon-a11y` manually to set it up.');
        }
      }
    }

    logger.step('Migration completed successfully!');
    logger.log(`For more information, see: ${FRAMEWORK_DOC_URL}`);
  },
};
