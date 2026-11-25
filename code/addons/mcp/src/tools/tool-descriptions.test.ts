import type { ToolAvailability } from 'storybook/internal/core-server';
import { getRegisteredToolsets, registerToolset } from 'storybook/open-service';

import { ValibotJsonSchemaAdapter } from '@tmcp/adapter-valibot';
import { describe, expect, it } from 'vitest';

import { createTestToolset } from '../../../vitest/src/node/toolset/definition.ts';
import { registerCoreToolsetsForTest } from '../test-support/register-core-toolsets.ts';
import { getAddonToolMetadata } from './tool-registry.ts';

// Claude Code cuts MCP tool descriptions off after this many characters, so anything past it
// never reaches the model.
const MCP_CLIENT_DESCRIPTION_CHAR_LIMIT = 2048;

// Bold, italics and code spans add characters without changing what the model reads.
const MARKDOWN_EMPHASIS = /\*\*|`|(?<![\w$])_\w+_(?!\w)|(?<![\w*])\*\w(?:[^*\n]*\w)?\*(?![\w*])/;

const bools = [true, false] as const;

function availabilityWith(testSupported: boolean, a11yEnabled: boolean): ToolAvailability {
  return {
    moduleGraphSupported: true,
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
  multiSource: boolean;
  testSupported: boolean;
  a11yEnabled: boolean;
}) {
  const { multiSource, testSupported, a11yEnabled } = options;
  registerCoreToolsetsForTest();
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
  'review-create',
  'stories-changed',
  'stories-find-by-component',
  'stories-preview',
  'test-run',
];

describe('MCP tool descriptions', () => {
  it('stay plain text within the MCP client truncation limit for every tool in every configuration', () => {
    for (const multiSource of bools)
      for (const testSupported of bools)
        for (const a11yEnabled of bools) {
          const options = { multiSource, testSupported, a11yEnabled };
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

  // `tools/list` converts every input and output schema with this adapter, and one schema it cannot
  // convert (a valibot `transform`, say) fails the whole list, taking every tool down with it.
  it('convert to JSON Schema the way the MCP server lists them, for every registered toolset', async () => {
    toolMetadataFor({ multiSource: false, testSupported: true, a11yEnabled: true });
    const adapter = new ValibotJsonSchemaAdapter();
    const methods = getRegisteredToolsets().flatMap((toolset) =>
      Object.entries(toolset.methods).map(([name, method]) => ({
        ref: `${toolset.id}.${name}`,
        method,
      }))
    );

    expect(methods.map(({ ref }) => ref)).toContain('test.run');
    for (const { ref, method } of methods) {
      for (const [kind, schema] of [
        ['input', method.input],
        ['output', method.output],
      ] as const) {
        if (schema) {
          await expect
            .soft(adapter.toJsonSchema(schema as never), `${ref} ${kind}`)
            .resolves.toBeTypeOf('object');
        }
      }
    }
  });
});
