import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import { fs as memfs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { logger } from 'storybook/internal/node-logger';

import type { CheckOptions, RunOptions } from '../types.ts';
import {
  type angularViteRemoveCompodoc as FixType,
  angularViteRemoveCompodoc,
} from './angular-vite-remove-compodoc.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

vi.mock('globby', { spy: true });

vi.mock('storybook/internal/node-logger', { spy: true });

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getProjectRoot: vi.fn(() => '/project'),
}));

const ANGULAR_VITE_BUILDER = '@storybook/angular-vite';
const ANGULAR_BUILDER = '@storybook/angular';

const MAIN = '/project/.storybook/main.ts';
const PREVIEW = '/project/.storybook/preview.ts';
const ANGULAR_JSON = '/project/angular.json';
const PROJECT_JSON = '/project/libs/ui/project.json';
const WEBPACK_PROJECT_JSON = '/project/apps/legacy/project.json';
const NX_JSON = '/project/nx.json';
const PACKAGE_JSON = '/project/package.json';

const PREVIEW_WITH_WIRING = dedent`
  import { setCompodocJson } from "@storybook/addon-docs/angular";
  import docJson from "../documentation.json";
  setCompodocJson(docJson);

  export const parameters = { controls: { expanded: true } };
`;

const angularJson = (options: Record<string, unknown>, builder = ANGULAR_VITE_BUILDER) =>
  JSON.stringify({
    projects: {
      app: {
        root: '',
        projectType: 'application',
        architect: {
          storybook: { builder: `${builder}:start-storybook`, options },
        },
      },
    },
  });

// Nx: one project per file, targets at the root, `executor` rather than `builder`.
const projectJson = (options: Record<string, unknown>, executor = ANGULAR_VITE_BUILDER) =>
  JSON.stringify({
    name: 'ui',
    targets: {
      storybook: { executor: `${executor}:start-storybook`, options },
    },
  });

// Nx workspace defaults: no builder/executor at all, just a bare target name.
const nxJson = (options: Record<string, unknown>) =>
  JSON.stringify({ targetDefaults: { 'build-storybook': { options } } });

// Stands in for `JsPackageManager`: package.json is read through a process-wide cache that a raw
// `writeFileSync` cannot invalidate, and every write serialises that cache back over the file.
// `flushCache()` is what any later `addDependencies` does to the same file.
const packageManager = (hasCompodoc: boolean) => {
  let cached: any;
  const read = () => (cached ??= JSON.parse(memfs.readFileSync(PACKAGE_JSON, 'utf8') as string));
  const write = (json: any) => {
    cached = json;
    memfs.writeFileSync(PACKAGE_JSON, `${JSON.stringify(json, null, 2)}\n`);
  };

  return {
    packageJsonPaths: [PACKAGE_JSON],
    getDependencyVersion: vi.fn().mockResolvedValue(hasCompodoc ? '^1.1.0' : null),
    removeDependencies: vi.fn(async (dependencies: string[]) => {
      const json = read();
      dependencies.forEach((dependency) => delete json.devDependencies?.[dependency]);
      write(json);
    }),
    writePackageJson: vi.fn((json: any) => write(json)),
    flushCache: () => write(read()),
  } as unknown as JsPackageManager & { flushCache: () => void };
};

const checkOptions = (
  mainConfig: Partial<StorybookConfigRaw>,
  { hasCompodoc = false }: { hasCompodoc?: boolean } = {}
) =>
  ({
    mainConfig: { framework: { name: '@storybook/angular-vite' }, ...mainConfig } as never,
    mainConfigPath: MAIN,
    previewConfigPath: PREVIEW,
    packageManager: packageManager(hasCompodoc),
  }) as unknown as CheckOptions;

beforeEach(() => {
  vol.reset();
  vol.fromNestedJSON({ '/project/package.json': '{}' });
  vi.mocked(fs.existsSync).mockImplementation(memfs.existsSync as never);
  vi.mocked(fs.readFileSync).mockImplementation(memfs.readFileSync as never);
  vi.mocked(fs.writeFileSync).mockImplementation(memfs.writeFileSync as never);
  vi.mocked(fsPromises.readFile).mockImplementation(memfs.promises.readFile as never);
  vi.mocked(fsPromises.writeFile).mockImplementation(memfs.promises.writeFile as never);
  // globby walks the real disk, which memfs has replaced. Resolve `project.json` files out of the
  // virtual volume instead, so discovery is still what decides which files the fix sees.
  vi.mocked(globby).mockImplementation(async (patterns, options) => {
    const basenames = [patterns].flat().map((pattern) => pattern.replaceAll('**/', ''));
    return Object.keys(vol.toJSON()).filter(
      (path) =>
        basenames.some((basename) => path.endsWith(`/${basename}`)) &&
        !options?.ignore?.some((pattern) =>
          path.includes(`/${pattern.replaceAll('**/', '').replaceAll('/**', '')}/`)
        )
    ) as never;
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('check', () => {
  it('skips a project that is not on angular-vite', async () => {
    const result = await angularViteRemoveCompodoc.check({
      ...checkOptions({}),
      mainConfig: { framework: { name: '@storybook/angular' } } as never,
    });

    expect(result).toBeNull();
  });

  it('skips a project that opted out of the docgen server', async () => {
    const result = await angularViteRemoveCompodoc.check(
      checkOptions({
        framework: { name: '@storybook/angular-vite', options: { compodoc: true } },
        features: { experimentalDocgenServer: false },
      } as never)
    );

    expect(result).toBeNull();
  });

  it('skips a project with no Compodoc setup left', async () => {
    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('detects the framework options', async () => {
    const result = await angularViteRemoveCompodoc.check(
      checkOptions({
        framework: {
          name: '@storybook/angular-vite',
          options: { compodoc: true, compodocArgs: ['-e', 'json'] },
        },
      } as never)
    );

    expect(result).toMatchObject({ hasFrameworkOptions: true });
  });

  it('detects the preview wiring', async () => {
    vol.fromNestedJSON({ [PREVIEW]: PREVIEW_WITH_WIRING });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result).toMatchObject({ hasPreviewWiring: true });
  });

  it('detects the angular.json builder options', async () => {
    vol.fromNestedJSON({ [ANGULAR_JSON]: angularJson({ compodoc: true }) });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result?.workspaceJsonEdits.map((edit) => edit.filePath)).toEqual([ANGULAR_JSON]);
  });

  it('detects the Compodoc options in an Nx project.json', async () => {
    vol.fromNestedJSON({ [PROJECT_JSON]: projectJson({ compodoc: true }) });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result?.workspaceJsonEdits.map((edit) => edit.filePath)).toContain(PROJECT_JSON);
  });

  it('ignores an angular.json whose storybook target has no Compodoc options', async () => {
    vol.fromNestedJSON({ [ANGULAR_JSON]: angularJson({ port: 6006 }) });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('discovers project.json files from the workspace root, not the working directory', async () => {
    vol.fromNestedJSON({ [PROJECT_JSON]: projectJson({ compodoc: true }) });

    await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(globby).toHaveBeenCalledWith(
      ['**/project.json'],
      expect.objectContaining({
        cwd: '/project',
        absolute: true,
        ignore: expect.arrayContaining(['**/storybook-static/**']),
      })
    );
  });

  it('detects the Compodoc dependency on its own', async () => {
    const result = await angularViteRemoveCompodoc.check(checkOptions({}, { hasCompodoc: true }));

    expect(result).toMatchObject({ hasCompodocDependency: true });
  });

  // `:start-storybook` is a suffix every Angular Storybook builder shares.
  it('ignores a workspace file whose storybook target belongs to the Webpack builder', async () => {
    vol.fromNestedJSON({
      [WEBPACK_PROJECT_JSON]: projectJson({ compodoc: false }, ANGULAR_BUILDER),
      [ANGULAR_JSON]: angularJson({ compodoc: false }, ANGULAR_BUILDER),
    });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('picks the angular-vite target out of a workspace that still has Webpack ones', async () => {
    vol.fromNestedJSON({
      [WEBPACK_PROJECT_JSON]: projectJson({ compodoc: false }, ANGULAR_BUILDER),
      [PROJECT_JSON]: projectJson({ compodoc: true }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result?.workspaceJsonEdits.map((edit) => edit.filePath)).toEqual([PROJECT_JSON]);
  });

  it('ignores a project.json that Storybook itself wrote into its build output', async () => {
    vol.fromNestedJSON({
      '/project/storybook-static/project.json': projectJson({ compodoc: true }),
    });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  // A bare-name `targetDefaults` entry names no package, so it is only attributable once every
  // Storybook target left in the workspace is on angular-vite.
  it('detects the Compodoc options in nx.json targetDefaults', async () => {
    vol.fromNestedJSON({
      [NX_JSON]: nxJson({ compodoc: true, compodocArgs: ['-e', 'json'] }),
      [PROJECT_JSON]: projectJson({ port: 6006 }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result?.workspaceJsonEdits).toEqual([
      {
        filePath: NX_JSON,
        optionPaths: [
          ['targetDefaults', 'build-storybook', 'options', 'compodoc'],
          ['targetDefaults', 'build-storybook', 'options', 'compodocArgs'],
        ],
      },
    ]);
  });

  it('leaves nx.json targetDefaults alone while a Webpack storybook target still inherits them', async () => {
    vol.fromNestedJSON({
      [NX_JSON]: nxJson({ compodoc: true, compodocArgs: ['-e', 'json'] }),
      [WEBPACK_PROJECT_JSON]: projectJson({ port: 6006 }, ANGULAR_BUILDER),
    });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  // Nx can crystallize the Storybook targets from a plugin instead of declaring them, so "no
  // foreign target is declared" is not evidence that every project moved to angular-vite.
  it('leaves bare-name targetDefaults alone when no workspace file declares a Storybook target', async () => {
    vol.fromNestedJSON({ [NX_JSON]: nxJson({ compodoc: true, compodocArgs: ['-e', 'json'] }) });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('leaves bare-name targetDefaults alone when another targetDefault names the Webpack executor', async () => {
    vol.fromNestedJSON({
      [NX_JSON]: JSON.stringify({
        targetDefaults: {
          'build-storybook': { options: { compodoc: true } },
          '@storybook/angular:build-storybook': { cache: true },
        },
      }),
      [PROJECT_JSON]: projectJson({ port: 6006 }),
    });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  // A leftover key in a configuration is a hard Architect validation failure.
  it('detects Compodoc options declared under configurations, not just options', async () => {
    vol.fromNestedJSON({
      [PROJECT_JSON]: JSON.stringify({
        name: 'ui',
        targets: {
          'build-storybook': {
            executor: `${ANGULAR_VITE_BUILDER}:build-storybook`,
            options: { configDir: '.storybook' },
            configurations: { ci: { compodoc: false, compodocArgs: ['-e', 'json'] } },
          },
        },
      }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result?.workspaceJsonEdits).toEqual([
      {
        filePath: PROJECT_JSON,
        optionPaths: [
          ['targets', 'build-storybook', 'configurations', 'ci', 'compodoc'],
          ['targets', 'build-storybook', 'configurations', 'ci', 'compodocArgs'],
        ],
      },
    ]);
  });

  it('does not mistake a project\u2019s own data file for the Compodoc documentation.json', async () => {
    vol.fromNestedJSON({ [PREVIEW]: 'import meta from "../api-documentation.json";' });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('does not mistake a comment mentioning the Compodoc setup for wiring', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        // We used to call setCompodocJson with "../documentation.json" here.
        const note = 'setCompodocJson("../documentation.json")';

        export default { note };
      `,
    });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('detects a documentation.json fed in through a dynamic import', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: 'const docs = await import("../documentation.json");',
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result).toMatchObject({ hasPreviewWiring: true });
  });

  // A preview can route the `setCompodocJson` call through an imported helper, leaving only the
  // `documentation.json` import behind.
  it('detects preview wiring that only imports documentation.json', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import docJson from "../documentation.json";
        import { wire } from "./wire-compodoc";

        wire(docJson);
      `,
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result).toMatchObject({ hasPreviewWiring: true });
  });

  it('reports package.json scripts that still invoke the Compodoc binary', async () => {
    vol.fromNestedJSON({
      [PACKAGE_JSON]: JSON.stringify({
        scripts: {
          'docs:json': 'compodoc -p ./tsconfig.json -e json -d . --disableRoutesGraph',
          compodoc: 'npx compodoc -c doc/compodoc_sources/.compodocrc.json',
          scoped: 'npx @compodoc/compodoc -p tsconfig.json',
        },
      }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}, { hasCompodoc: true }));

    expect(result?.compodocScripts).toEqual([
      { packageJsonPath: PACKAGE_JSON, scriptName: 'docs:json' },
      { packageJsonPath: PACKAGE_JSON, scriptName: 'compodoc' },
      { packageJsonPath: PACKAGE_JSON, scriptName: 'scoped' },
    ]);
  });

  it('sees the Compodoc binary behind a host command, a wrapper and shell punctuation', async () => {
    vol.fromNestedJSON({
      [PACKAGE_JSON]: JSON.stringify({
        scripts: {
          'docs:cli': 'node ./node_modules/@compodoc/compodoc/bin/index-cli.js -p tsconfig.json',
          'docs:bin': 'node node_modules/.bin/compodoc -p tsconfig.json',
          'docs:watch': 'concurrently "compodoc -s -w" "ng serve"',
          'docs:group': '(compodoc -p tsconfig.json)',
          'docs:win': 'compodoc.cmd -p tsconfig.json',
        },
      }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}, { hasCompodoc: true }));

    expect(result?.compodocScripts.map(({ scriptName }) => scriptName)).toEqual([
      'docs:cli',
      'docs:bin',
      'docs:watch',
      'docs:group',
      'docs:win',
    ]);
  });

  it('finds a Compodoc script in a workspace package the package manager does not enumerate', async () => {
    const nested = '/project/tools/api-docs/package.json';
    vol.fromNestedJSON({
      [nested]: JSON.stringify({
        scripts: { build: 'compodoc -p ../../tsconfig.json -e json -d .' },
      }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}, { hasCompodoc: true }));

    expect(result?.compodocScripts).toEqual([{ packageJsonPath: nested, scriptName: 'build' }]);
  });

  it('does not mistake a path or a word that merely contains "compodoc" for the binary', async () => {
    vol.fromNestedJSON({
      [PACKAGE_JSON]: JSON.stringify({
        scripts: {
          clean: 'rimraf dist/compodoc',
          lint: 'eslint ./compodoc-theme --fix',
          docs: 'npm run docs:html',
          serve: 'http-server compodoc-static',
        },
      }),
    });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}, { hasCompodoc: true }));

    expect(result?.compodocScripts).toEqual([]);
  });
});

describe('run', () => {
  const runWith = async (result: Awaited<ReturnType<typeof FixType.check>>, pm: JsPackageManager) =>
    angularViteRemoveCompodoc.run!({
      result: result!,
      dryRun: false,
      mainConfigPath: MAIN,
      previewConfigPath: PREVIEW,
      packageManager: pm,
    } as unknown as RunOptions<never>);

  it('strips the setCompodocJson wiring but keeps the rest of the preview', async () => {
    vol.fromNestedJSON({ [PREVIEW]: PREVIEW_WITH_WIRING });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const preview = vol.readFileSync(PREVIEW, 'utf8') as string;
    expect(preview).not.toContain('setCompodocJson');
    expect(preview).not.toContain('documentation.json');
    expect(preview).toContain('controls');
  });

  it('removes only the specifiers that fed the call', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCompodocJson } from "@storybook/addon-docs/angular";
        import docJson, { components } from "../documentation.json";

        setCompodocJson(docJson);

        export const componentCount = components.length;
      `,
    });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const preview = vol.readFileSync(PREVIEW, 'utf8') as string;
    expect(preview).not.toContain('setCompodocJson');
    expect(preview).not.toContain('docJson');
    expect(preview).toContain('import { components } from "../documentation.json"');
  });

  // A call wrapped in a helper that also pre-processes the JSON cannot be rewritten safely.
  it('leaves a preview alone when setCompodocJson is not called at the top level', async () => {
    const wrapped = dedent`
      import { setCompodocJson } from "@storybook/addon-docs/angular";
      import docs from "../documentation.json";

      function addDocs(docs) {
        removeProperties(docs);
        setCompodocJson(docs);
      }

      addDocs(docs);
    `;
    vol.fromNestedJSON({ [PREVIEW]: wrapped });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    expect(vol.readFileSync(PREVIEW, 'utf8')).toBe(wrapped);
  });

  it('keeps the documentation.json import when other code still reads it', async () => {
    const alsoUsed = dedent`
      import { setCompodocJson } from "@storybook/addon-docs/angular";
      import docJson from "../documentation.json";

      setCompodocJson(docJson);

      export const componentCount = docJson.components.length;
    `;
    vol.fromNestedJSON({ [PREVIEW]: alsoUsed });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const preview = vol.readFileSync(PREVIEW, 'utf8') as string;
    expect(preview).not.toContain('setCompodocJson');
    expect(preview).toContain('documentation.json');
    expect(preview).toContain('docJson.components.length');
  });

  it('drops the Compodoc builder options and leaves the others alone', async () => {
    vol.fromNestedJSON({
      [ANGULAR_JSON]: angularJson({ compodoc: true, compodocArgs: ['-e', 'json'], port: 6006 }),
    });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: false,
        workspaceJsonEdits: [
          {
            filePath: ANGULAR_JSON,
            optionPaths: [
              ['projects', 'app', 'architect', 'storybook', 'options', 'compodoc'],
              ['projects', 'app', 'architect', 'storybook', 'options', 'compodocArgs'],
            ],
          },
        ],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const written = JSON.parse(vol.readFileSync(ANGULAR_JSON, 'utf8') as string);
    const { options } = written.projects.app.architect.storybook;
    expect(options).not.toHaveProperty('compodoc');
    expect(options).not.toHaveProperty('compodocArgs');
    expect(options.port).toBe(6006);
  });

  it('drops the Compodoc options from an Nx project.json too', async () => {
    vol.fromNestedJSON({
      [PROJECT_JSON]: projectJson({ compodoc: true, compodocArgs: ['-e', 'json'], port: 6006 }),
    });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: false,
        workspaceJsonEdits: [
          {
            filePath: PROJECT_JSON,
            optionPaths: [
              ['targets', 'storybook', 'options', 'compodoc'],
              ['targets', 'storybook', 'options', 'compodocArgs'],
            ],
          },
        ],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const written = JSON.parse(vol.readFileSync(PROJECT_JSON, 'utf8') as string);
    const { options } = written.targets.storybook;
    expect(options).not.toHaveProperty('compodoc');
    expect(options).not.toHaveProperty('compodocArgs');
    expect(options.port).toBe(6006);
  });

  it('removes the Compodoc dependency', async () => {
    const pm = packageManager(true);

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: false,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: true,
      },
      pm
    );

    expect(pm.removeDependencies).toHaveBeenCalledWith(['@compodoc/compodoc']);
  });

  it('keeps the dependency and names the scripts that still need it', async () => {
    vol.fromNestedJSON({
      [PACKAGE_JSON]: JSON.stringify({
        scripts: {
          'build-compodoc': 'compodoc -p ./tsconfig.compodoc-html.json -d compodoc-static',
        },
      }),
    });
    const pm = packageManager(true);

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: false,
        workspaceJsonEdits: [],
        compodocScripts: [{ packageJsonPath: PACKAGE_JSON, scriptName: 'build-compodoc' }],
        hasCompodocDependency: true,
      },
      pm
    );

    expect(pm.removeDependencies).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`build-compodoc" in ${PACKAGE_JSON}`)
    );
  });

  it('drops a dangling @compodoc/compodoc override that a later package-manager write cannot restore', async () => {
    vol.fromNestedJSON({
      [PACKAGE_JSON]: JSON.stringify(
        {
          name: 'app',
          overrides: { '@compodoc/compodoc': { 'pdfjs-dist': '4.2.67' }, other: '1.0.0' },
          resolutions: { '@compodoc/compodoc': '^1.1.0' },
          pnpm: { overrides: { '@compodoc/compodoc': '1.1.19', other: '1.0.0' } },
          devDependencies: { '@compodoc/compodoc': '^1.1.23' },
        },
        null,
        2
      ),
    });
    const pm = packageManager(true);

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: false,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: true,
      },
      pm
    );
    pm.flushCache();

    const written = JSON.parse(vol.readFileSync(PACKAGE_JSON, 'utf8') as string);
    expect(written.overrides).toEqual({ other: '1.0.0' });
    expect(written.resolutions).toEqual({});
    expect(written.pnpm.overrides).toEqual({ other: '1.0.0' });
    expect(written.devDependencies).toEqual({});
  });

  it('drops the Compodoc options from nx.json targetDefaults', async () => {
    vol.fromNestedJSON({
      [NX_JSON]: nxJson({ compodoc: true, compodocArgs: ['-e', 'json'], port: 4400 }),
    });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: false,
        workspaceJsonEdits: [
          {
            filePath: NX_JSON,
            optionPaths: [
              ['targetDefaults', 'build-storybook', 'options', 'compodoc'],
              ['targetDefaults', 'build-storybook', 'options', 'compodocArgs'],
            ],
          },
        ],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const written = JSON.parse(vol.readFileSync(NX_JSON, 'utf8') as string);
    expect(written.targetDefaults['build-storybook'].options).toEqual({ port: 4400 });
  });

  it('says only that no call is visible when the preview just imports documentation.json', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import docJson from "../documentation.json";
        import { wire } from "./wire-compodoc";

        wire(docJson);
      `,
    });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no setCompodocJson call is visible here')
    );
    expect(vol.readFileSync(PREVIEW, 'utf8')).toContain('documentation.json');
  });

  it('says the call is not top level when the preview does contain one', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCompodocJson } from "@storybook/addon-docs/angular";
        import docs from "../documentation.json";

        function addDocs(docs) {
          setCompodocJson(docs);
        }

        addDocs(docs);
      `,
    });

    await runWith(
      {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [],
        compodocScripts: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('setCompodocJson is not called at the top level')
    );
  });

  it('changes nothing on a dry run, and says what it would change instead', async () => {
    vol.fromNestedJSON({
      [PREVIEW]: PREVIEW_WITH_WIRING,
      [NX_JSON]: nxJson({ compodoc: true }),
      [PACKAGE_JSON]: JSON.stringify({
        overrides: { '@compodoc/compodoc': '1.1.19' },
        devDependencies: { '@compodoc/compodoc': '^1.1.23' },
      }),
    });
    const pm = packageManager(true);

    await angularViteRemoveCompodoc.run!({
      result: {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonEdits: [
          {
            filePath: NX_JSON,
            optionPaths: [['targetDefaults', 'build-storybook', 'options', 'compodoc']],
          },
        ],
        compodocScripts: [],
        hasCompodocDependency: true,
      },
      dryRun: true,
      mainConfigPath: MAIN,
      previewConfigPath: PREVIEW,
      packageManager: pm,
    } as unknown as RunOptions<never>);

    expect(vol.readFileSync(PREVIEW, 'utf8')).toContain('setCompodocJson');
    expect(JSON.parse(vol.readFileSync(NX_JSON, 'utf8') as string)).toEqual(
      JSON.parse(nxJson({ compodoc: true }))
    );
    expect(pm.removeDependencies).not.toHaveBeenCalled();
    expect(pm.writePackageJson).not.toHaveBeenCalled();

    const reported = vi.mocked(logger.step).mock.calls.flat().join('\n');
    expect(reported).toContain(`Would remove the Compodoc builder options from ${NX_JSON}`);
    expect(reported).toContain(`Would remove the setCompodocJson wiring from ${PREVIEW}`);
    expect(reported).toContain('Would remove @compodoc/compodoc');
    expect(reported).toContain(`Would remove the dangling @compodoc/compodoc override`);
  });
});
