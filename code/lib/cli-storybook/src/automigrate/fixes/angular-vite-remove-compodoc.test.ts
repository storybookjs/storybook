import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import { fs as memfs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import type { CheckOptions, RunOptions } from '../types.ts';
import {
  type angularViteRemoveCompodoc as FixType,
  angularViteRemoveCompodoc,
} from './angular-vite-remove-compodoc.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });

vi.mock('globby', { spy: true });

const MAIN = '/project/.storybook/main.ts';
const PREVIEW = '/project/.storybook/preview.ts';
const ANGULAR_JSON = '/project/angular.json';
const PROJECT_JSON = '/project/libs/ui/project.json';

const PREVIEW_WITH_WIRING = dedent`
  import { setCompodocJson } from "@storybook/addon-docs/angular";
  import docJson from "../documentation.json";
  setCompodocJson(docJson);

  export const parameters = { controls: { expanded: true } };
`;

const angularJson = (options: Record<string, unknown>) =>
  JSON.stringify({
    projects: {
      app: {
        root: '',
        projectType: 'application',
        architect: {
          storybook: { builder: '@storybook/angular-vite:start-storybook', options },
        },
      },
    },
  });

// Nx: one project per file, targets at the root, `executor` rather than `builder`.
const projectJson = (options: Record<string, unknown>) =>
  JSON.stringify({
    name: 'ui',
    targets: {
      storybook: { executor: '@storybook/angular-vite:start-storybook', options },
    },
  });

const packageManager = (hasCompodoc: boolean) =>
  ({
    packageJsonPaths: ['/project/package.json'],
    getDependencyVersion: vi.fn().mockResolvedValue(hasCompodoc ? '^1.1.0' : null),
    removeDependencies: vi.fn().mockResolvedValue(undefined),
  }) as unknown as JsPackageManager;

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
  vi.mocked(globby).mockImplementation(
    async () => Object.keys(vol.toJSON()).filter((path) => path.endsWith('/project.json')) as never
  );
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

    expect(result?.workspaceJsonPaths).toEqual([ANGULAR_JSON]);
  });

  it('detects the Compodoc options in an Nx project.json', async () => {
    vol.fromNestedJSON({ [PROJECT_JSON]: projectJson({ compodoc: true }) });

    const result = await angularViteRemoveCompodoc.check(checkOptions({}));

    expect(result?.workspaceJsonPaths).toContain(PROJECT_JSON);
  });

  it('ignores an angular.json whose storybook target has no Compodoc options', async () => {
    vol.fromNestedJSON({ [ANGULAR_JSON]: angularJson({ port: 6006 }) });

    expect(await angularViteRemoveCompodoc.check(checkOptions({}))).toBeNull();
  });

  it('detects the Compodoc dependency on its own', async () => {
    const result = await angularViteRemoveCompodoc.check(checkOptions({}, { hasCompodoc: true }));

    expect(result).toMatchObject({ hasCompodocDependency: true });
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
        workspaceJsonPaths: [],
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
        workspaceJsonPaths: [],
        hasCompodocDependency: false,
      },
      packageManager(false)
    );

    const preview = vol.readFileSync(PREVIEW, 'utf8') as string;
    expect(preview).not.toContain('setCompodocJson');
    expect(preview).not.toContain('docJson');
    expect(preview).toContain('import { components } from "../documentation.json"');
  });

  // The shape `vmware-clarity/ng-clarity` ships: the call is wrapped in a helper that also
  // pre-processes the JSON, so rewriting it automatically is not safe.
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
        workspaceJsonPaths: [],
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
        workspaceJsonPaths: [],
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
        workspaceJsonPaths: [ANGULAR_JSON],
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
        workspaceJsonPaths: [PROJECT_JSON],
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
        workspaceJsonPaths: [],
        hasCompodocDependency: true,
      },
      pm
    );

    expect(pm.removeDependencies).toHaveBeenCalledWith(['@compodoc/compodoc']);
  });

  it('changes nothing on a dry run', async () => {
    vol.fromNestedJSON({ [PREVIEW]: PREVIEW_WITH_WIRING });
    const pm = packageManager(true);

    await angularViteRemoveCompodoc.run!({
      result: {
        hasFrameworkOptions: false,
        hasPreviewWiring: true,
        workspaceJsonPaths: [],
        hasCompodocDependency: true,
      },
      dryRun: true,
      mainConfigPath: MAIN,
      previewConfigPath: PREVIEW,
      packageManager: pm,
    } as unknown as RunOptions<never>);

    expect(vol.readFileSync(PREVIEW, 'utf8')).toContain('setCompodocJson');
    expect(pm.removeDependencies).not.toHaveBeenCalled();
  });
});
