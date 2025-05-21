import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { loadConfig, printConfig } from 'storybook/internal/csf-tools';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { getAddonAnnotations } from './get-addon-annotations';
import { getSyncedStorybookAddons } from './sync-main-preview-addons';

vi.mock('./get-addon-annotations');

expect.addSnapshotSerializer({
  serialize: (val: any) => (typeof val === 'string' ? dedent(val) : dedent(val.toString())),
  test: () => true,
});

describe('getSyncedStorybookAddons', () => {
  const mainConfig: StorybookConfigRaw = {
    stories: [],
    addons: ['custom-addon', '@storybook/addon-a11y'],
  };

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

    const result = await getSyncedStorybookAddons(mainConfig, preview);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";
      import * as myAddonAnnotations from "custom-addon/preview";
      import { definePreview } from "@storybook/react/preview";

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

    const result = await getSyncedStorybookAddons(mainConfig, preview);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import addonA11yAnnotations from "@storybook/addon-a11y";
      import * as myAddonAnnotations from "custom-addon/preview";
      import { definePreview } from "@storybook/react/preview";

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

    const result = await getSyncedStorybookAddons(mainConfig, preview);
    expect(printConfig(result).code).toMatchInlineSnapshot(`
      import * as addonA11yAnnotations from "@storybook/addon-a11y/preview";
      import { definePreview } from "@storybook/react/preview";

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

    const result = await getSyncedStorybookAddons(mainConfig, preview);
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

    const result = await getSyncedStorybookAddons(mainConfig, preview);
    const transformedCode = normalizeLineBreaks(printConfig(result).code);

    expect(transformedCode).toMatch(originalCode);
  });
});
