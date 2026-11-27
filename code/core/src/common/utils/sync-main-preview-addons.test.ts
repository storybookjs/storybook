import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { loadConfig, printConfig } from 'storybook/internal/csf-tools';
import { logger } from 'storybook/internal/node-logger';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { getAddonAnnotations } from './get-addon-annotations.ts';
import { syncPreviewAddonsWithMainConfig } from './sync-main-preview-addons.ts';

vi.mock('./get-addon-annotations');

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? dedent(val) : dedent(val.toString())),
  test: () => true,
});

describe('syncPreviewAddonsWithMainConfig', () => {
  const mainConfig: StorybookConfigRaw = {
    stories: [],
    addons: ['custom-addon', '@storybook/addon-a11y'],
  };

  const configDir = '/user/storybook/.storybook';

  it('should sync addons between main and preview', async () => {
    const preview = loadConfig(`
      import * as myAddonAnnotations from "custom-addon/preview";
      import { definePreview } from "@storybook/react/preview";

      export default definePreview({
        addons: [myAddonAnnotations],
      });
    `).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import * as myAddonAnnotations from "custom-addon/preview";
            import { definePreview } from "@storybook/react/preview";
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";

            export default definePreview({
              addons: [myAddonAnnotations, addonA11yAnnotations],
            });
    `);
  });

  it('should sync addons as functions when they are core packages', async () => {
    const preview = loadConfig(`
      import * as myAddonAnnotations from "custom-addon/preview";
      import { definePreview } from "@storybook/react/preview";

      export default definePreview({
        addons: [myAddonAnnotations],
      });
    `).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return {
        importName: 'addonA11yAnnotations',
        importPath: '@storybook/addon-a11y',
        isCoreAddon: true,
      };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import * as myAddonAnnotations from "custom-addon/preview";
            import { definePreview } from "@storybook/react/preview";
      import addonA11yAnnotations from "@storybook/addon-a11y";

            export default definePreview({
              addons: [myAddonAnnotations, addonA11yAnnotations()],
            });
    `);
  });

  it('should add addons if the preview has no addons field', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";

      export default definePreview({
        tags: []
      });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import { definePreview } from "@storybook/react/preview";
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";

      export default definePreview({
        tags: [],
        addons: [addonA11yAnnotations]
      });
    `);
  });

  // necessary for windows and unix output to match in the assertions
  const normalizeLineBreaks = (str: string) => str.replace(/\r/g, '').trim();
  it('should not add an addon if its annotations path has already been imported', async () => {
    const originalCode = dedent`
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";
      import * as myAddonAnnotations from "custom-addon/preview";
      import { definePreview } from "@storybook/react/preview";
      const extraAddons = [addonA11yAnnotations]
      export default definePreview({
        addons: [myAddonAnnotations, ...extraAddons],
      });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    const transformedCode = normalizeLineBreaks(printConfig(result).code);

    expect(transformedCode).toMatch(originalCode);
  });

  it('should not modify the code if all addons are already synced', async () => {
    const originalCode = dedent`
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";
      import * as myAddonAnnotations from "custom-addon/preview";
      import { definePreview } from "@storybook/react/preview";

      export default definePreview({
        addons: [myAddonAnnotations, addonA11yAnnotations],
      });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    const transformedCode = normalizeLineBreaks(printConfig(result).code);

    expect(transformedCode).toMatch(originalCode);
  });

  it('adds an addon to an addons constant that only the preview refers to', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";

      const addons = [];
      export default definePreview({ addons });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import { definePreview } from "@storybook/react/preview";
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";

      const addons = [addonA11yAnnotations];
      export default definePreview({ addons });
    `);
  });

  it('carries forward the addons of a spread when the preview writes none', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";
      import shared from "./shared";

      export default definePreview({ ...shared });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import { definePreview } from "@storybook/react/preview";
      import shared from "./shared";
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";

      export default definePreview({ ...shared, addons: [...(shared.addons ?? []), addonA11yAnnotations] });
    `);
  });

  it('leaves an addons array alone that a later spread could replace', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";
      import shared from "./shared";

      export default definePreview({
        addons: [],
        ...shared,
      });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);

    expect(printConfig(result).code).toBe(originalCode);
    expect(result.mutationDiagnostics).toEqual([]);
  });

  it.each([
    ['holds a call', 'definePreview({ addons: getAddons() })', "got 'CallExpression'"],
    ['a computed key could provide', 'definePreview({ [key]: [] })', 'dynamic key'],
    [
      'a spread that cannot be carried forward could provide',
      'definePreview({ ...getBase() })',
      'spread field',
    ],
  ])('leaves alone, with a warning, addons that %s', async (_case, call, reason) => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";

      export default ${call};
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);

    expect(printConfig(result).code).toBe(originalCode);
    expect(result.mutationDiagnostics).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(reason));
  });

  it('leaves alone, with a warning, an addons constant that other code refers to as well', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";

      const addons = [];
      register(addons);
      export default definePreview({ addons });
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);

    expect(printConfig(result).code).toBe(originalCode);
    expect(result.mutationDiagnostics).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('other code refers to'));
  });

  it('leaves alone, with a warning, a preview that mixes a default export with named exports', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";

      export const tags = [];
      export default definePreview({});
    `;
    const preview = loadConfig(originalCode).parse();

    (getAddonAnnotations as Mock).mockImplementation(() => {
      return { importName: 'addonA11yAnnotations', importPath: '@storybook/addon-a11y/preview' };
    });

    const result = await syncPreviewAddonsWithMainConfig(mainConfig, preview, configDir);

    expect(printConfig(result).code).toBe(originalCode);
    expect(result.mutationDiagnostics).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Not synchronizing the preview addons')
    );
  });

  it('should add an empty addons array if no addons are installed', async () => {
    const originalCode = dedent`
      import { definePreview } from "@storybook/react/preview";

      export default definePreview({});
    `;
    const preview = loadConfig(originalCode).parse();

    const result = await syncPreviewAddonsWithMainConfig(
      {
        addons: [],
        stories: [],
      },
      preview,
      configDir
    );
    const transformedCode = normalizeLineBreaks(printConfig(result).code);

    expect(transformedCode).toMatchInlineSnapshot(`
      import { definePreview } from "@storybook/react/preview";

      export default definePreview({ addons: [] });
    `);
  });
});
