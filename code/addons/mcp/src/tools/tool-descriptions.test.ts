import type { ToolAvailability } from 'storybook/internal/core-server';
import { registerToolset } from 'storybook/open-service';
import { describe, expect, it } from 'vitest';

import { createTestToolset } from '../../../vitest/src/node/toolset/definition.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata } from './tool-registry.ts';

// Claude Code cuts MCP tool descriptions off after this many characters, so anything past it
// never reaches the model.
const MCP_CLIENT_DESCRIPTION_CHAR_LIMIT = 2048;

const bools = [true, false] as const;

function availabilityWith(testSupported: boolean, a11yEnabled: boolean): ToolAvailability {
  return {
    moduleGraphSupported: true,
    changeDetectionEnabled: true,
    reviewEnabled: true,
    reviewEnabledForCli: true,
    docsEnabled: true,
    docsEnabledForCli: true,
    docsHasManifests: true,
    docsFeatureEnabled: true,
    testSupported,
    a11yEnabled,
    docgenServer: true,
  };
}

function toolMetadataFor(options: {
  reviewEnabled: boolean;
  multiSource: boolean;
  testSupported: boolean;
  a11yEnabled: boolean;
}) {
  const { reviewEnabled, multiSource, testSupported, a11yEnabled } = options;
  registerCoreToolsetsForTest({ reviewEnabled });
  registerToolset(
    createTestToolset({
      channel: { on: () => {}, off: () => {}, emit: () => {} },
      storyIndex: { getIndex: async () => ({ v: 5, entries: {} }) },
      a11yEnabled,
    })
  );
  return getAddonToolMetadata({
    availability: availabilityWith(testSupported, a11yEnabled),
    multiSource,
  });
}

describe('MCP tool descriptions', () => {
  it('stay within the MCP client truncation limit for every tool in every configuration', () => {
    const seenTools = new Set<string>();

    for (const reviewEnabled of bools)
      for (const multiSource of bools)
        for (const testSupported of bools)
          for (const a11yEnabled of bools) {
            const options = { reviewEnabled, multiSource, testSupported, a11yEnabled };
            for (const tool of toolMetadataFor(options)) {
              seenTools.add(tool.name);
              const length = tool.description?.length ?? 0;
              expect.soft(length, `${tool.name} has no description`).toBeGreaterThan(0);
              expect
                .soft(length, `${tool.name} exceeds the limit for ${JSON.stringify(options)}`)
                .toBeLessThanOrEqual(MCP_CLIENT_DESCRIPTION_CHAR_LIMIT);
            }
          }

    expect([...seenTools].sort()).toEqual([
      'docs-list',
      'docs-show',
      'docs-show-story',
      'get-storybook-story-instructions',
      'review-create',
      'stories-changed',
      'stories-find-by-component',
      'stories-preview',
      'test-run',
    ]);
  });
});
