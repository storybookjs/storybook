import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import { builderGlobalsNameReferenceMap, globalsNameReferenceMap } from './globals.ts';

const require = createRequire(import.meta.url);
const coreExports = Object.keys(require('@storybook/core/package.json').exports);

describe('preview globals', () => {
  it('maps every core specifier of a globalized key to the same global', () => {
    const coreTwins = Object.entries(globalsNameReferenceMap)
      .filter(([key]) => key.startsWith('storybook/'))
      .map(([key, global]) => [`@storybook/core${key.slice('storybook'.length)}`, global])
      .filter(([specifier]) =>
        coreExports.includes(`.${specifier.slice('@storybook/core'.length)}`)
      );

    expect(
      coreTwins.map(([specifier]) => [specifier, builderGlobalsNameReferenceMap[specifier]])
    ).toEqual(coreTwins);
  });

  it('lists each lower-package specifier with its global', () => {
    expect(
      Object.fromEntries(
        Object.entries(builderGlobalsNameReferenceMap).filter(([key]) =>
          key.startsWith('@storybook/core/')
        )
      )
    ).toMatchInlineSnapshot(`
      {
        "@storybook/core/internal/channels": "__STORYBOOK_MODULE_CHANNELS__",
        "@storybook/core/internal/client-logger": "__STORYBOOK_MODULE_CLIENT_LOGGER__",
        "@storybook/core/internal/core-events": "__STORYBOOK_MODULE_CORE_EVENTS__",
        "@storybook/core/internal/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__",
        "@storybook/core/internal/preview-errors": "__STORYBOOK_MODULE_CORE_EVENTS_PREVIEW_ERRORS__",
        "@storybook/core/internal/types": "__STORYBOOK_MODULE_TYPES__",
        "@storybook/core/preview-api": "__STORYBOOK_MODULE_PREVIEW_API__",
        "@storybook/core/test": "__STORYBOOK_MODULE_TEST__",
      }
    `);
  });
});
