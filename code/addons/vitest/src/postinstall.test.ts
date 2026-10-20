import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { types as t } from 'storybook/internal/babel';
import { babelParse, generate, traverse } from 'storybook/internal/babel';
import type { JsPackageManager } from 'storybook/internal/common';
import {
  getStorybookInfo,
  JsPackageManagerFactory,
  PackageManagerName,
} from 'storybook/internal/common';
import { AddonVitestPostinstallPrerequisiteCheckError } from 'storybook/internal/server-errors';
import { SupportedBuilder, SupportedFramework } from 'storybook/internal/types';

import * as find from 'empathic/find';
import { vol } from 'memfs';
import { resolve } from 'pathe';
import { dedent } from 'ts-dedent';

import {
  ANGULAR_VITEST_PLUGIN_CALL,
  injectAngularVitestIntoAst,
  injectAngularVitestIntoConfig,
} from './angular-vitest-postinstall.ts';
import postInstall, { getTemplateConfigDir, isConfigAlreadySetup } from './postinstall.ts';
import { loadTemplate, updateConfigFile } from './updateVitestFile.ts';
import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('empathic/find', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
// The storybook package's export map resolves `storybook/internal/cli` to the built dist bundle,
// whose inlined copies of `empathic/find` cannot be intercepted by the spy above. Loading the
// service from source keeps the CommonJS-guard search inside the mocked module graph.
vi.mock(
  'storybook/internal/cli',
  async () =>
    await vi.importActual<Record<string, unknown>>('../../../core/src/cli/AddonVitestService.ts')
);

/**
 * Returns the callee names of the plugins array that holds the (possibly aliased) storybookTest
 * call, in source order. Asserts co-location: the Angular bridge must sit in the SAME array.
 */
function pluginCalleesInSameArray(code: string, locatorName = 'storybookTest'): string[] | null {
  const ast = babelParse(code);
  let elements: string[] | null = null;
  traverse(ast, {
    CallExpression(path) {
      if (elements) {
        path.stop();
        return;
      }
      const { callee } = path.node;
      if (
        callee.type === 'Identifier' &&
        callee.name === locatorName &&
        path.parentPath.isArrayExpression()
      ) {
        elements = (path.parentPath.node as t.ArrayExpression).elements.map((el) =>
          el?.type === 'CallExpression' && el.callee.type === 'Identifier'
            ? el.callee.name
            : 'other'
        );
        path.stop();
      }
    },
  });
  return elements;
}

describe('getTemplateConfigDir', () => {
  it('returns the config dir relative to the generated config file directory', () => {
    // Both inputs are cwd-relative, so the result is independent of the test cwd.
    expect(getTemplateConfigDir('vitest.config.ts', '.storybook')).toBe('.storybook');
  });

  it('does not double the path when the config file lives in a monorepo subproject', () => {
    // `storybook add --config-dir apps/x/.storybook` run from the repo root, with the
    // new vitest.config.ts created inside apps/x.
    expect(getTemplateConfigDir('apps/x/vitest.config.ts', 'apps/x/.storybook')).toBe('.storybook');
  });

  it('keeps a relative climb when the config dir is above the config file', () => {
    expect(getTemplateConfigDir('apps/x/vitest.config.ts', '.storybook')).toBe('../../.storybook');
  });

  it('supports a custom config dir name', () => {
    expect(getTemplateConfigDir('apps/x/vitest.config.ts', 'apps/x/sb-config')).toBe('sb-config');
  });
});

describe('postinstall helpers', () => {
  it('detects a fully configured Vitest config with addon plugin', () => {
    const config = `
      import { defineConfig } from 'vitest/config';
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

      export default defineConfig({
        test: {
          projects: [
            {
              extends: true,
              plugins: [storybookTest({ configDir: '.storybook' })],
            },
          ],
        },
      });
    `;

    expect(isConfigAlreadySetup('/project/vitest.config.ts', config)).toBe(true);
  });

  it('returns false when storybookTest plugin is not used', () => {
    const config = `
      import { defineConfig } from 'vitest/config';

      export default defineConfig({
        test: {
          projects: [
            {
              extends: true,
            },
          ],
        },
      });
    `;

    expect(isConfigAlreadySetup('/project/vitest.config.ts', config)).toBe(false);
  });
});

describe('CommonJS config guard (storybook add flow)', () => {
  // A real CommonJS vitest config: `module.exports` gives the merge path no default export to
  // rewrite, so without the guard the run can only end in the generic manual-setup error.
  const cjsConfigContent = dedent`
    const { defineConfig } = require('vitest/config');

    module.exports = defineConfig({
      test: {
        environment: 'node',
      },
    });
  `;

  // An already-wired config whose export shape the merger cannot rewrite (a defineConfig
  // callback with control flow resolves to no config object, so canUpdateVitestConfigFile
  // rejects it): rerunning the add flow must still succeed via the skip path instead of
  // failing the shape guard.
  const wiredCallbackConfigContent = dedent`
    import { defineConfig } from 'vite';
    import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';

    export default defineConfig(({ mode }) => {
      if (mode === 'development') {
        return { plugins: [storybookTest({ configDir: '.storybook' })] };
      }
      return { plugins: [storybookTest({ configDir: '.storybook' })] };
    });
  `;

  // An unwired config whose export shape the merger cannot rewrite (a defineConfig callback
  // with control flow): with the guard active, the add flow must stop at the prerequisite
  // step with the specific invalid-config reason instead of installing dependencies and
  // failing later with the generic merge error.
  const unwiredCallbackConfigContent = dedent`
    import { defineConfig } from 'vite';

    export default defineConfig(({ mode }) => {
      if (mode === 'production') {
        return { test: { environment: 'node' } };
      }
      return { test: { environment: 'jsdom' } };
    });
  `;

  // Nested so the search-window assertion can tell a config-dir search from a cwd search.
  const configDir = 'config/storybook';

  // Discovery fixture: test cases declare WHAT discovery finds; the find.any implementation
  // that serves it stays in beforeEach per the repository's spy-mocking rules.
  let discoveredConfig: { basename: string; path: string } | undefined;

  // Declares the one config file discovery finds and loads it into memfs at that path, so the
  // fixture is the single source of the content (no second copy to drift out of sync).
  const discover = (basename: string, content: string) => {
    const path = resolve(process.cwd(), basename);
    discoveredConfig = { basename, path };
    vol.fromJSON({ [path]: content });
  };

  let mockPackageManager: JsPackageManager;

  beforeEach(async () => {
    vi.clearAllMocks();
    discoveredConfig = undefined;

    // Reads and writes stay in memfs; nothing in these flows may touch the real checkout.
    const memfs = await vi.importActual<typeof import('memfs')>('memfs');
    vi.mocked(readFile).mockImplementation(
      memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
    );
    vi.mocked(writeFile).mockImplementation(
      memfs.fs.promises.writeFile as unknown as typeof import('node:fs/promises').writeFile
    );

    mockPackageManager = {
      getAllDependencies: vi.fn().mockReturnValue({}),
      getInstalledVersion: vi.fn().mockResolvedValue(null),
      getDeclaredVersionSpecifier: vi.fn().mockResolvedValue(null),
      runPackageCommand: vi.fn(),
      getPackageCommand: vi.fn(),
      applyVersionToRelatedPackages: vi.fn((packages: string[], version: string) =>
        packages.map((pkg) => `${pkg}@${version}`)
      ),
    } as Partial<JsPackageManager> as JsPackageManager;

    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue(mockPackageManager);
    vi.mocked(getStorybookInfo).mockResolvedValue({
      framework: SupportedFramework.REACT_VITE,
      builder: SupportedBuilder.VITE,
    } as Awaited<ReturnType<typeof getStorybookInfo>>);

    vi.mocked(find.any).mockImplementation((names: string[]) =>
      discoveredConfig && names.includes(discoveredConfig.basename)
        ? discoveredConfig.path
        : undefined
    );
  });

  afterEach(() => {
    vol.reset();
    // Spy mocks persist file-wide and clearAllMocks only clears call history, so reset the
    // implementations this describe installed to keep later describes on clean mocks.
    vi.mocked(readFile).mockReset();
    vi.mocked(writeFile).mockReset();
    vi.mocked(find.any).mockReset();
  });

  const runPostinstall = () => {
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      log: vi.fn(),
      step: vi.fn(),
      warn: vi.fn(),
    };
    return postInstall({
      configDir,
      packageManager: PackageManagerName.NPM,
      logger: logger as unknown as PostinstallOptions['logger'],
      prompt: {} as unknown as PostinstallOptions['prompt'],
      skipDependencyManagement: true,
      skipInstall: true,
    });
  };

  it.each(['cts', 'cjs'] as const)(
    'rejects a vitest.config.%s with the CommonJS guard instead of attempting the merge',
    async (ext) => {
      discover(`vitest.config.${ext}`, cjsConfigContent);

      const error = await runPostinstall().then(
        () => null,
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(AddonVitestPostinstallPrerequisiteCheckError);
      const reasons =
        error instanceof AddonVitestPostinstallPrerequisiteCheckError ? error.data.reasons : [];
      expect(reasons.some((r) => r.includes('Cannot auto-update CommonJS config file'))).toBe(true);

      // The guard must search from the config dir, not the cwd: pin every vitest.config
      // discovery call to the nested config directory so a wrongly wired projectRoot fails.
      const guardCalls = vi
        .mocked(find.any)
        .mock.calls.filter(([names]) => names.some((name) => name.startsWith('vitest.config.')));
      expect(guardCalls.length).toBeGreaterThan(0);
      expect(guardCalls.every(([, options]) => options?.cwd === configDir)).toBe(true);
    }
  );

  it('skips the guard for an already-configured config the merger cannot rewrite', async () => {
    discover('vitest.config.ts', wiredCallbackConfigContent);

    // The already-wired config takes the skip path and is never rewritten, so its unmergeable
    // callback export must not surface as a prerequisite error.
    const error = await runPostinstall().then(
      () => null,
      (e: unknown) => e
    );
    expect(error).toBeNull();
  });

  it('rejects an unwired ESM config the merger cannot rewrite with the shape guard', async () => {
    discover('vitest.config.ts', unwiredCallbackConfigContent);

    const error = await runPostinstall().then(
      () => null,
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(AddonVitestPostinstallPrerequisiteCheckError);
    const reasons =
      error instanceof AddonVitestPostinstallPrerequisiteCheckError ? error.data.reasons : [];
    expect(reasons.some((r) => r.includes('Found an invalid Vitest config file'))).toBe(true);
  });
});

describe('Angular bridge wiring (postinstall integration)', () => {
  it('fresh-create v4: co-locates the bridge in the template plugins array (case 5)', async () => {
    const template = await loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' });
    const out = injectAngularVitestIntoConfig(template);
    expect(out).not.toBeNull();
    expect(pluginCalleesInSameArray(out!)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
    // Template comment survives the reprint (probe-locked path).
    expect(out).toContain('The plugin will run tests for the stories');
  });

  it('existing-config sequencing: merge storybookTest, then co-locate the bridge (case 4)', async () => {
    // Mirrors postinstall's existing-config branch: updateConfigFile merges the template into the
    // user's vite config, then injectAngularVitestIntoAst runs on the SAME (merged) target.
    const source = babelParse(
      await loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' })
    );
    const target = babelParse(`
      import { defineConfig } from 'vite'
      import react from '@vitejs/plugin-react'
      export default defineConfig({
        plugins: [react()],
        test: { globals: true },
      })
    `);

    expect(updateConfigFile(source, target)).toBe(true);
    expect(injectAngularVitestIntoAst(target)).toBe(true);

    const after = generate(target).code;
    expect(pluginCalleesInSameArray(after)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
    // The bridge must NOT be deposited as a top-level plugins sibling (react stays alone).
    expect(pluginCalleesInSameArray(after, 'react')).toEqual(['react']);
  });

  it('arrow-function config: merges storybookTest and co-locates the bridge (case 4)', async () => {
    // Function-notation configs (e.g. `defineConfig(() => ({ ... }))`) are now
    // supported by updateConfigFile, so the merge succeeds and the Angular bridge
    // co-locates with storybookTest in the same plugins array.
    const source = babelParse(
      await loadTemplate('vitest.config.4.template', { CONFIG_DIR: '.storybook' })
    );
    const target = babelParse(`
      import { defineConfig } from 'vite'
      export default defineConfig(() => ({ test: { globals: true } }))
    `);
    expect(updateConfigFile(source, target)).toBe(true);
    expect(injectAngularVitestIntoAst(target)).toBe(true);
    expect(pluginCalleesInSameArray(generate(target).code)).toEqual([
      ANGULAR_VITEST_PLUGIN_CALL,
      'storybookTest',
    ]);
  });

  it('early-return-safe: storybookTest present but bridge absent still injects (case 9)', () => {
    // Simulates the alreadyConfigured fall-through: storybookTest is wired, Angular is not.
    const existing = `
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      export default {
        test: { projects: [{ extends: true, plugins: [storybookTest({ configDir: '.storybook' })] }] },
      };
    `;
    const out = injectAngularVitestIntoConfig(existing);
    expect(out).not.toBeNull();
    expect(pluginCalleesInSameArray(out!)).toEqual([ANGULAR_VITEST_PLUGIN_CALL, 'storybookTest']);
  });

  it('non-Angular is unaffected: injector is never invoked, config has no bridge (case 11)', () => {
    // The postinstall gate (info.framework === ANGULAR_VITE) is what skips the injector for
    // react-vite; the injector itself only acts when explicitly called. This documents that a
    // react-vite fresh-create config contains no Angular references.
    const reactConfig = `
      import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
      export default { test: { projects: [{ plugins: [storybookTest({})] }] } };
    `;
    expect(reactConfig).not.toContain(ANGULAR_VITEST_PLUGIN_CALL);
  });
});
