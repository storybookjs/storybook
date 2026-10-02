import type { ToolAvailability } from 'storybook/internal/core-server';
import { registerToolset } from 'storybook/open-service';
import { describe, expect, it } from 'vitest';

import { createTestToolset } from '../../../vitest/src/node/toolset/definition.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata } from './tool-registry.ts';

// Claude Code cuts MCP tool descriptions off after this many characters, so anything past it
// never reaches the model.
const MCP_CLIENT_DESCRIPTION_CHAR_LIMIT = 2048;

// Bold, italics and code spans add characters without changing what the model reads.
const MARKDOWN_EMPHASIS = /\*\*|`|(?<![\w$])_\w+_(?!\w)|(?<![\w*])\*\w(?:[^*\n]*\w)?\*(?![\w*])/;

// Claude Code gives the model only `structuredContent` once a tool publishes an output schema, so
// what the text of such a tool tells the agent to do next has to be in the schema as well.
const TOOLS_WHOSE_TEXT_ONLY_RENDERS_THEIR_DATA = ['stories-find-by-component'];

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

const TOOL_NAMES = [
  'docs-list',
  'docs-show',
  'docs-show-story',
  'get-storybook-story-instructions',
  'review-create',
  'stories-changed',
  'stories-find-by-component',
  'stories-preview',
  'test-run',
];

describe('MCP tool descriptions', () => {
  it('stay plain text within the MCP client truncation limit for every tool in every configuration', () => {
    for (const reviewEnabled of bools)
      for (const multiSource of bools)
        for (const testSupported of bools)
          for (const a11yEnabled of bools) {
            const options = { reviewEnabled, multiSource, testSupported, a11yEnabled };
            const tools = toolMetadataFor(options);

            expect(tools.map((tool) => tool.name).sort()).toEqual(
              TOOL_NAMES.filter((name) => testSupported || name !== 'test-run')
            );
            for (const tool of tools) {
              const length = tool.description?.length ?? 0;
              expect.soft(length, `${tool.name} has no description`).toBeGreaterThan(0);
              expect
                .soft(length, `${tool.name} exceeds the limit for ${JSON.stringify(options)}`)
                .toBeLessThanOrEqual(MCP_CLIENT_DESCRIPTION_CHAR_LIMIT);
              expect
                .soft(tool.description, `${tool.name} spends its budget on markdown emphasis`)
                .not.toMatch(MARKDOWN_EMPHASIS);
            }
          }
  });
});

describe('MCP tool output schemas', () => {
  it('carry the instructions of every tool whose text does more than render its data', () => {
    const tools = toolMetadataFor({
      reviewEnabled: true,
      multiSource: false,
      testSupported: true,
      a11yEnabled: true,
    });

    const withoutInstructions = tools
      .filter((tool) => {
        if (!tool.outputSchema) {
          return false;
        }
        const { entries = {} } = tool.outputSchema as { entries?: Record<string, unknown> };
        return !('instructions' in entries);
      })
      .map((tool) => tool.name);

    expect(withoutInstructions).toEqual(TOOLS_WHOSE_TEXT_ONLY_RENDERS_THEIR_DATA);
  });
});
