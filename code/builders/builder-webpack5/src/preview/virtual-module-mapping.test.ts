import { describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { getVirtualModules } from './virtual-module-mapping.ts';

// Minimal Options: presets.apply resolves to the base value, and configDir points at a path with
// no config/preview files so loadPreviewOrConfigFile finds nothing.
const getOptions = () =>
  ({
    configDir: '/virtual-module-mapping-test-does-not-exist',
    configType: 'PRODUCTION',
    presets: {
      apply: vi.fn(async (_name: string, baseConfig: unknown) =>
        _name === 'stories' ? ['../src/**/*.stories.@(js|ts)'] : baseConfig
      ),
    },
  }) as unknown as Options;

describe('virtual module mapping', () => {
  it('substitutes the csf import with the builder-context path and keeps externalized imports bare', async () => {
    const { virtualModules, entries } = await getVirtualModules(getOptions());
    const entry = virtualModules[entries[0]];

    expect(entry).toBeDefined();

    // A bare `storybook/internal/csf` specifier would be resolved by webpack from the user's
    // project root, which can be a different Storybook copy than the builder producing the build.
    // The placeholder must be fully substituted with an absolute builder-context path.
    expect(entry).not.toContain('storybook/internal/csf');
    expect(entry).not.toContain('{{csfImportPath}}');

    const csfImport = entry.match(/^import \{ isPreview \} from '(.+)';$/m);
    expect(csfImport?.[1]).toMatch(/^(?:[A-Za-z]:)?[/\\]/);
    expect(csfImport?.[1]).toMatch(/[/\\]dist[/\\]csf[/\\]index\.js$/);

    // The four externalized imports stay bare — webpack externalizes them via
    // globalsNameReferenceMap, so they inherit the version of the sb-preview globals runtime.
    expect(entry).toContain("from 'storybook/internal/channels';");
    expect(entry).toContain("from 'storybook/internal/core-events';");
    expect(entry).toContain("from '@storybook/global';");
    expect(entry).toContain("from 'storybook/preview-api';");
  });
});
