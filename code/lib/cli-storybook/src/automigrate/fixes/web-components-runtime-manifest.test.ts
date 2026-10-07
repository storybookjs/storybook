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
      enableDocgenServer: false,
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
      name: 'skips when experimentalDocgenServer is false',
      files: { [PREVIEW]: PREVIEW_WITH_MANIFEST },
      mainConfig: { features: { experimentalDocgenServer: false } } as never,
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
        enableDocgenServer: true,
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
        enableDocgenServer: true,
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
        enableDocgenServer: true,
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
        enableDocgenServer: true,
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
      name: 'reports enableDocgenServer as false when the flag is already true',
      files: { '/project/custom-elements.json': CEM, [PREVIEW]: PREVIEW_WITH_MANIFEST },
      mainConfig: { features: { experimentalDocgenServer: true } } as never,
      expected: {
        setterNames: ['setCustomElementsManifest'],
        manifestPath: '../custom-elements.json',
        enableDocgenServer: false,
      },
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
        enableDocgenServer: true,
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
        enableDocgenServer: true,
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
        enableDocgenServer: true,
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
        enableDocgenServer: true,
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
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Left the setCustomElementsManifest() call in /project/.storybook/preview.ts alone: ' +
        '/project/custom-elements.json is not a readable Custom Elements Manifest. Generate ' +
        'one with @custom-elements-manifest/analyzer, then rerun "storybook automigrate ' +
        'web-components-runtime-manifest".'
    );
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
    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      'Left the setCustomElementsManifest() call in /project/.storybook/preview.ts alone: ' +
        '/project/custom-elements.json is not a readable Custom Elements Manifest. Generate ' +
        'one with @custom-elements-manifest/analyzer, then rerun "storybook automigrate ' +
        'web-components-runtime-manifest".'
    );
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
          options: {
            builder: { viteConfigPath: 'vite.config.ts' },
            customElementsManifest: '../custom-elements.json'
          },
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
      "export default { framework: {
        name: '@storybook/web-components-vite',

        options: {
          customElementsManifest: '../custom-elements.json'
        }
      } };"
    `);
  });

  it('sets experimentalDocgenServer only when unset', async (): Promise<void> => {
    await runWith({ enableDocgenServer: true });

    expect(vol.readFileSync(MAIN, 'utf8')).toMatchInlineSnapshot(`
      "export default {
        framework: {
          name: '@storybook/web-components-vite',

          options: {
            customElementsManifest: '../custom-elements.json'
          }
        },

        features: {
          experimentalDocgenServer: true
        }
      };"
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
      "export default { framework: {
        name: '@storybook/web-components-vite',

        options: {
          customElementsManifest: '../custom-elements.json'
        }
      } };"
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
