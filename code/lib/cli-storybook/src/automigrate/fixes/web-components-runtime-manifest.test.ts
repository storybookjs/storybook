import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import * as fsPromises from 'node:fs/promises';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import { fs as memfs, vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import type { CheckOptions, RunOptions } from '../types.ts';
import {
  type WebComponentsRuntimeManifestOptions,
  webComponentsRuntimeManifest,
} from './web-components-runtime-manifest.ts';

vi.mock('node:fs/promises', { spy: true });

vi.mock('globby', { spy: true });

vi.mock('storybook/internal/node-logger', { spy: true });

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  findFilesUp: vi.fn(() => ['/project/package.json']),
  getProjectRoot: vi.fn(() => '/project'),
}));

const MAIN = '/project/.storybook/main.ts';
const NESTED_PREVIEW = '/project/.storybook/config/preview.ts';
const PACKAGE_JSON = '/project/package.json';
const PREVIEW = '/project/.storybook/preview.ts';
const WEB_COMPONENTS_VITE = '@storybook/web-components-vite';
const CEM = JSON.stringify({ schemaVersion: '1.0.0', modules: [] });
const CEM_WITHOUT_SCHEMA_VERSION = JSON.stringify({ modules: [] });
const WCA_MANIFEST = JSON.stringify({ version: 'experimental', tags: [] });

const PREVIEW_WITH_MANIFEST = dedent`
  import { setCustomElementsManifest } from "@storybook/web-components";
  import customElements from "../custom-elements.json";

  setCustomElementsManifest(customElements);

  export const parameters = { controls: { expanded: true } };
`;

const checkOptions = (
  mainConfig: Partial<StorybookConfigRaw>,
  previewConfigPath = PREVIEW
): CheckOptions =>
  ({
    mainConfig: { framework: { name: WEB_COMPONENTS_VITE }, ...mainConfig } as never,
    mainConfigPath: MAIN,
    previewConfigPath,
    storiesPaths: [],
    storybookVersion: '11.0.0',
  }) as unknown as CheckOptions;

const runWith = async (
  result: Partial<WebComponentsRuntimeManifestOptions> = {},
  previewConfigPath = PREVIEW
): Promise<void> => {
  await runFix(webComponentsRuntimeManifest, {
    result: {
      setterNames: ['setCustomElementsManifest'],
      manifestPath: '../custom-elements.json',
      manifestFiles: ['/project/custom-elements.json'],
      ...result,
    },
    mainConfigPath: MAIN,
    previewConfigPath,
    storiesPaths: [],
    mainConfig: { framework: { name: WEB_COMPONENTS_VITE } } as never,
    configDir: '/project/.storybook',
    storybookVersion: '11.0.0',
  } as unknown as Omit<RunOptions<WebComponentsRuntimeManifestOptions>, 'files'>);
};

beforeEach((): void => {
  vol.reset();
  vol.fromNestedJSON({
    [MAIN]: "export default { framework: { name: '@storybook/web-components-vite' } };",
    [PACKAGE_JSON]: '{}',
    [PREVIEW]: 'export const parameters = {};',
  });
  vi.mocked(fsPromises.readFile).mockImplementation(memfs.promises.readFile as never);
  vi.mocked(fsPromises.writeFile).mockImplementation(memfs.promises.writeFile as never);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(logger.debug).mockImplementation(() => {});
  vi.mocked(globby).mockImplementation(async (patterns, options): Promise<string[]> => {
    const basenames = [patterns].flat().map((pattern) => pattern.replaceAll('**/', ''));
    return Object.keys(vol.toJSON()).filter(
      (path) =>
        basenames.some((basename) => path.endsWith(`/${basename}`)) &&
        !options?.ignore?.some((pattern) =>
          path.includes(`/${pattern.replaceAll('**/', '').replaceAll('/**', '')}/`)
        )
    );
  });
});

afterEach((): void => {
  vi.clearAllMocks();
});

type CheckCase = {
  name: string;
  files: Record<string, string>;
  mainConfig?: Partial<StorybookConfigRaw>;
  previewConfigPath?: string;
  expected: WebComponentsRuntimeManifestOptions | null;
};

describe('check', (): void => {
  const CHECK_CASES: CheckCase[] = [
    {
      name: 'skips a React project',
      files: { [PREVIEW]: PREVIEW_WITH_MANIFEST },
      mainConfig: { framework: { name: '@storybook/react-vite' } } as never,
      expected: null,
    },
    {
      name: 'skips when docgenServer is false',
      files: { [PREVIEW]: PREVIEW_WITH_MANIFEST },
      mainConfig: { features: { docgenServer: false } } as never,
      expected: null,
    },
    {
      name: 'skips a preview without the call',
      files: {},
      expected: null,
    },
    {
      name: 'detects setCustomElementsManifest with a default JSON import',
      files: { '/project/custom-elements.json': CEM, [PREVIEW]: PREVIEW_WITH_MANIFEST },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'accepts a manifest without schemaVersion',
      files: {
        '/project/custom-elements.json': CEM_WITHOUT_SCHEMA_VERSION,
        [PREVIEW]: PREVIEW_WITH_MANIFEST,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'resolves the path when the preview lives in a nested directory',
      files: {
        '/project/custom-elements.json': CEM,
        [NESTED_PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import manifest from "../../custom-elements.json";

          setCustomElementsManifest(manifest);
        `,
      },
      previewConfigPath: NESTED_PREVIEW,
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'detects setCustomElements too',
      files: {
        '/project/custom-elements.json': CEM,
        [PREVIEW]: dedent`
          import { setCustomElements } from "@storybook/web-components";
          import customElements from "../custom-elements.json";

          setCustomElements(customElements);
        `,
      },
      expected: {
        setterNames: ['setCustomElements'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'returns null for an inline object argument without another manifest source',
      files: {
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";

          setCustomElementsManifest({});
        `,
      },
      expected: null,
    },
    {
      name: 'returns null for a package manifest import without another manifest source',
      files: {
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import customElements from "custom-elements-manifest";

          setCustomElementsManifest(customElements);
        `,
      },
      expected: null,
    },
    {
      name: 'returns null for a helper call without another manifest source',
      files: {
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import customElements from "../custom-elements.json";

          function setup() {
            setCustomElementsManifest(customElements);
          }
        `,
      },
      expected: null,
    },
    {
      name: 'uses package.json customElements for an inline object argument',
      files: {
        '/project/custom-elements.json': CEM,
        [PACKAGE_JSON]: JSON.stringify({ customElements: 'custom-elements.json' }),
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";

          setCustomElementsManifest({});
        `,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: null,
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'uses the workspace manifest when the preview imports a package manifest',
      files: {
        '/project/custom-elements.json': CEM,
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import customElements from "custom-elements-manifest";

          setCustomElementsManifest(customElements);
        `,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'uses the workspace manifest when the call sits inside a helper function',
      files: {
        '/project/custom-elements.json': CEM,
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";

          function setup() {
            setCustomElementsManifest({});
          }
        `,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'uses the workspace manifest when the setter argument wraps the import',
      files: {
        '/project/custom-elements.json': CEM,
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import customElements from "../custom-elements.json";

          setCustomElementsManifest(format(customElements));
        `,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'uses package.json customElements when the setter reads a derived variable',
      files: {
        '/project/custom-elements.json': CEM,
        [PACKAGE_JSON]: JSON.stringify({ customElements: 'custom-elements.json' }),
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import customElements from "../custom-elements.json";

          const m = format(customElements);
          setCustomElementsManifest(m);
        `,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: null,
        manifestFiles: ['/project/custom-elements.json'],
      },
    },
    {
      name: 'returns null when the workspace search finds two manifests',
      files: {
        '/project/apps/a/custom-elements.json': CEM,
        '/project/apps/b/custom-elements.json': CEM,
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";

          setCustomElementsManifest({});
        `,
      },
      expected: null,
    },
    {
      name: 'returns null when no manifest source is found',
      files: {
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";

          setCustomElementsManifest({});
        `,
      },
      expected: null,
    },
    {
      name: 'prefers a preview import over package and workspace manifests',
      files: {
        '/project/custom-elements.json': CEM,
        '/project/preview-elements.json': CEM,
        [PACKAGE_JSON]: JSON.stringify({ customElements: 'package-elements.json' }),
        [PREVIEW]: dedent`
          import { setCustomElementsManifest } from "@storybook/web-components";
          import previewElements from "../preview-elements.json";

          setCustomElementsManifest(previewElements);
        `,
      },
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../preview-elements.json',
        manifestFiles: ['/project/preview-elements.json'],
      },
    },
  ];

  it.each(CHECK_CASES)(
    '$name',
    async ({ files, mainConfig = {}, previewConfigPath, expected }): Promise<void> => {
      vol.fromNestedJSON(files);

      const result = await checkFix(
        webComponentsRuntimeManifest,
        checkOptions(mainConfig, previewConfigPath)
      );

      expect(result).toEqual(expected);
    }
  );

  it('returns null and warns for a preview import of a WCA manifest', async (): Promise<void> => {
    vol.fromNestedJSON({
      '/project/custom-elements.json': WCA_MANIFEST,
      [PREVIEW]: PREVIEW_WITH_MANIFEST,
    });

    const result = await checkFix(webComponentsRuntimeManifest, checkOptions({}));

    expect(result).toBeNull();
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Left the setCustomElementsManifest() call in /project/.storybook/preview.ts alone: /project/custom-elements.json is not a readable Custom Elements Manifest.
      Generate one with @custom-elements-manifest/analyzer, then rerun "storybook automigrate web-components-runtime-manifest".",
        ],
      ]
    `);
  });

  it('returns null when package.json customElements includes a WCA manifest', async (): Promise<void> => {
    vol.fromNestedJSON({
      '/project/custom-elements.json': CEM,
      '/project/wca-elements.json': WCA_MANIFEST,
      [PACKAGE_JSON]: JSON.stringify({
        customElements: ['custom-elements.json', 'wca-elements.json'],
      }),
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";

        setCustomElementsManifest({});
      `,
    });

    expect(await checkFix(webComponentsRuntimeManifest, checkOptions({}))).toBeNull();
  });

  it('returns null when the workspace search finds a WCA manifest', async (): Promise<void> => {
    vol.fromNestedJSON({
      '/project/custom-elements.json': WCA_MANIFEST,
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";

        setCustomElementsManifest({});
      `,
    });

    expect(await checkFix(webComponentsRuntimeManifest, checkOptions({}))).toBeNull();
  });

  it('returns null and warns when a preview import cannot be read', async (): Promise<void> => {
    vol.fromNestedJSON({ [PREVIEW]: PREVIEW_WITH_MANIFEST });

    const result = await checkFix(webComponentsRuntimeManifest, checkOptions({}));

    expect(result).toBeNull();
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Left the setCustomElementsManifest() call in /project/.storybook/preview.ts alone: /project/custom-elements.json is not a readable Custom Elements Manifest.
      Generate one with @custom-elements-manifest/analyzer, then rerun "storybook automigrate web-components-runtime-manifest".",
        ],
      ]
    `);
  });
});

describe('run', (): void => {
  it('adds customElementsManifest to an object framework and keeps the other options', async (): Promise<void> => {
    vol.fromNestedJSON({
      [MAIN]: dedent`
        export default {
          framework: {
            name: '@storybook/web-components-vite',
            options: { builder: { viteConfigPath: 'vite.config.ts' } },
          },
        };
      `,
    });

    await runWith();

    expect(vol.readFileSync(MAIN, 'utf8')).toMatchInlineSnapshot(`
      "export default {
        framework: {
          name: '@storybook/web-components-vite',
          options: { builder: { viteConfigPath: 'vite.config.ts' }, customElementsManifest: '../custom-elements.json' },
        },
      };"
    `);
  });

  it('grows a string framework into the object form', async (): Promise<void> => {
    vol.fromNestedJSON({
      [MAIN]: "export default { framework: '@storybook/web-components-vite' };",
    });

    await runWith();

    expect(vol.readFileSync(MAIN, 'utf8')).toMatchInlineSnapshot(`
      "export default { framework: { name: '@storybook/web-components-vite', options: { customElementsManifest: '../custom-elements.json' } } };"
    `);
  });

  it('does not add features when main has no features', async (): Promise<void> => {
    vol.fromNestedJSON({
      [MAIN]: "export default { framework: { name: '@storybook/web-components-vite' } };",
    });

    await runWith();

    expect(vol.readFileSync(MAIN, 'utf8')).toMatchInlineSnapshot(`
      "export default { framework: { name: '@storybook/web-components-vite', options: { customElementsManifest: '../custom-elements.json' } } };"
    `);
  });

  it('leaves main unchanged when package.json customElements already names the manifest', async (): Promise<void> => {
    const main = "export default { framework: { name: '@storybook/web-components-vite' } };";
    vol.fromNestedJSON({
      [MAIN]: main,
      [PREVIEW]: PREVIEW_WITH_MANIFEST,
    });

    await runWith({ manifestPath: null });

    expect(vol.readFileSync(MAIN, 'utf8')).toBe(main);
    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = { controls: { expanded: true } };"
    `);
  });

  it('strips the call, the setter specifier and the JSON import', async (): Promise<void> => {
    vol.fromNestedJSON({ [PREVIEW]: PREVIEW_WITH_MANIFEST });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = { controls: { expanded: true } };"
    `);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('strips an inline object call and the setter specifier', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";

        setCustomElementsManifest({});

        export const parameters = {};
      `,
    });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = {};"
    `);
  });

  it('does not warn about a read JSON import of another file', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import tokens from "../tokens.json";

        setCustomElementsManifest({});

        export const tokenCount = tokens.length;
      `,
    });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import tokens from "../tokens.json";

      export const tokenCount = tokens.length;"
    `);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('strips both setters when the preview calls both', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElements, setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";
        import legacyElements from "../legacy-elements.json";

        setCustomElementsManifest(customElements);
        setCustomElements(legacyElements);

        export const parameters = {};
      `,
    });

    await runWith({ setterNames: ['setCustomElementsManifest', 'setCustomElements'] });

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = {};"
    `);
  });

  it('does not warn when both setters read the same JSON import', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElements, setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        setCustomElementsManifest(customElements);
        setCustomElements(customElements);

        export const parameters = {};
      `,
    });

    await runWith({ setterNames: ['setCustomElementsManifest', 'setCustomElements'] });

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = {};"
    `);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('only hints at manual removal when the other setter keeps the JSON import', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElements, setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        setCustomElementsManifest(customElements);
        setCustomElements(customElements);

        export const configure = setCustomElements;
      `,
    });

    await runWith({ setterNames: ['setCustomElementsManifest', 'setCustomElements'] });

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import { setCustomElements } from "@storybook/web-components";
      import customElements from "../custom-elements.json";
      setCustomElements(customElements);

      export const configure = setCustomElements;"
    `);
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "Left the setCustomElements wiring in /project/.storybook/preview.ts alone: setCustomElements is still used elsewhere.
      Remove the runtime call by hand when convenient.",
        ],
      ]
    `);
  });

  it('leaves helper-wrapped preview calls alone while migrating main', async (): Promise<void> => {
    const preview = dedent`
      import { setCustomElementsManifest } from "@storybook/web-components";

      function setup() {
        setCustomElementsManifest({});
      }
    `;
    vol.fromNestedJSON({ [PREVIEW]: preview });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toBe(preview);
    expect(vol.readFileSync(MAIN, 'utf8')).toMatchInlineSnapshot(`
      "export default { framework: { name: '@storybook/web-components-vite', options: { customElementsManifest: '../custom-elements.json' } } };"
    `);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('is not called at the top level')
    );
  });

  it('keeps the web-components-vite import when it has other specifiers', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { definePreview, setCustomElementsManifest } from "@storybook/web-components-vite";
        import customElements from "../custom-elements.json";

        setCustomElementsManifest(customElements);

        export default definePreview({});
      `,
    });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import { definePreview } from "@storybook/web-components-vite";

      export default definePreview({});"
    `);
  });

  it('keeps the JSON import when other code still reads it', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        setCustomElementsManifest(customElements);

        export const moduleCount = customElements.modules.length;
      `,
    });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import customElements from "../custom-elements.json";

      export const moduleCount = customElements.modules.length;"
    `);
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "/project/.storybook/preview.ts still imports ../custom-elements.json for: \`export const moduleCount = customElements.modules.length\`.
      Docgen now reads the manifest from disk, so changes made to it in the preview no longer apply, and the import makes the preview build fail when the manifest is invalid.
      Move manifest transforms into your manifest generator (for example an analyzer plugin), then remove the import.",
        ],
      ]
    `);
  });

  it('warns only about top-level readers of a surviving JSON import', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        WebComponentFormatter(customElements);
        setCustomElementsManifest(customElements);

        function WebComponentFormatter(customElements) {
          for (const module of customElements.modules) {
            module.path = module.path.replace(/\\.ts$/, '.js');
          }
        }
      `,
    });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import customElements from "../custom-elements.json";

      WebComponentFormatter(customElements);

      function WebComponentFormatter(customElements) {
        for (const module of customElements.modules) {
          module.path = module.path.replace(/\\.ts$/, '.js');
        }
      }"
    `);
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "/project/.storybook/preview.ts still imports ../custom-elements.json for: \`WebComponentFormatter(customElements)\`.
      Docgen now reads the manifest from disk, so changes made to it in the preview no longer apply, and the import makes the preview build fail when the manifest is invalid.
      Move manifest transforms into your manifest generator (for example an analyzer plugin), then remove the import.",
        ],
      ]
    `);
  });

  it('drops the JSON import when only a shadowing parameter shares its name', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        setCustomElementsManifest(customElements);

        export function count(customElements) { return customElements.modules.length; }
      `,
    });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export function count(customElements) { return customElements.modules.length; }"
    `);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('prints the reader code without its leading comment', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        // Fix the paths before docs read them
        WebComponentFormatter(customElements);
        setCustomElementsManifest(customElements);
      `,
    });

    await runWith();

    expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain(
      'for: `WebComponentFormatter(customElements)`.'
    );
  });

  it('drops a manifest import that only fed a wrapped setter argument', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        setCustomElementsManifest(format(customElements));

        export const parameters = {};
      `,
    });

    await runWith({ manifestPath: null });

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "export const parameters = {};"
    `);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns about a manifest import that feeds the setter through a variable', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import customElements from "../custom-elements.json";

        const m = format(customElements);
        setCustomElementsManifest(m);
      `,
    });

    await runWith({ manifestPath: null });

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import customElements from "../custom-elements.json";

      const m = format(customElements);
      "
    `);
    expect(vi.mocked(logger.warn).mock.calls).toMatchInlineSnapshot(`
      [
        [
          "/project/.storybook/preview.ts still imports ../custom-elements.json for: \`const m = format(customElements)\`.
      Docgen now reads the manifest from disk, so changes made to it in the preview no longer apply, and the import makes the preview build fail when the manifest is invalid.
      Move manifest transforms into your manifest generator (for example an analyzer plugin), then remove the import.",
        ],
      ]
    `);
  });

  it('leaves an unused JSON import of another file alone', async (): Promise<void> => {
    vol.fromNestedJSON({
      [PREVIEW]: dedent`
        import { setCustomElementsManifest } from "@storybook/web-components";
        import tokens from "../tokens.json";

        setCustomElementsManifest({});
      `,
    });

    await runWith({ manifestPath: null });

    expect(vol.readFileSync(PREVIEW, 'utf8')).toMatchInlineSnapshot(`
      "import tokens from "../tokens.json";
      "
    `);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('leaves the preview alone and warns when the setter is also referenced elsewhere', async (): Promise<void> => {
    const preview = dedent`
      import { setCustomElementsManifest } from "@storybook/web-components";
      import customElements from "../custom-elements.json";

      setCustomElementsManifest(customElements);

      export const configure = setCustomElementsManifest;
    `;
    vol.fromNestedJSON({ [PREVIEW]: preview });

    await runWith();

    expect(vol.readFileSync(PREVIEW, 'utf8')).toBe(preview);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('is still used elsewhere'));
  });
});
