import { describe, expect, it } from 'vitest';

import * as v from 'valibot';

import { defineToolset } from '../../shared/open-service/toolset-definition.ts';
import { renderMethodHelpFromCatalog } from '../tools/help.ts';
import { toCatalogEntry } from '../tools/sdk/catalog.ts';
import { renderCommandReference } from './command-reference.ts';

const handler = async () => ({ ok: true as const, data: {}, markdown: '' });

const docs = toCatalogEntry(
  defineToolset({
    id: 'docs',
    description: 'Documentation tools.',
    methods: {
      list: {
        title: 'List docs',
        description: 'List every documented component.',
        input: v.object({}),
        handler,
      },
      show: {
        title: 'Show docs',
        description: 'Show the docs of one component.',
        input: v.object({ id: v.pipe(v.string(), v.description('Component id')) }),
        output: v.object({ markdown: v.pipe(v.string(), v.description('Rendered docs')) }),
        handler: async () => ({ ok: true, data: { markdown: '' }, markdown: '' }),
      },
      showStory: {
        title: 'Show story docs',
        description: 'Show the docs of one story.',
        input: v.object({}),
        handler,
      },
    },
  }),
  { transport: 'cli', getService: () => ({}) as never }
);
const [, show, showStory] = docs.methods;

describe('renderCommandReference', () => {
  it('describes each tool the text names with its `--help` output', () => {
    const reference = renderCommandReference(
      'Call **npx storybook tools docs show** with an id from **npx storybook tools docs list**.',
      [docs]
    );

    expect(reference).toMatchInlineSnapshot(`
      "# Command reference

      The \`npx storybook tools\` commands named in this output, each exactly as its \`--help\` prints it, so there is no need to run \`--help\` first. Pass arguments as \`--key value\` flags, with array and object values as JSON (\`--key '[...]'\`), or all of them at once with \`--input '<json object>'\`. Add \`--json\` to print the data listed under Output instead of markdown.

      \`\`\`\`text
      Usage: npx storybook tools docs list [--key value ...]

      Execution: local (no running Storybook required).

      List every documented component.

      Arguments: none.
      \`\`\`\`

      \`\`\`\`text
      Usage: npx storybook tools docs show [--key value ...]

      Execution: local (no running Storybook required).

      Show the docs of one component.

      Arguments:
      - \`--id\` (string, required): Component id

      Output (\`--json\`):
      - \`markdown\` (string, required): Rendered docs
      \`\`\`\`"
    `);
  });

  it('does not take a longer command for the one it starts with', () => {
    const reference = renderCommandReference('Call `npx storybook tools docs show-story`.', [docs]);

    expect(reference).toContain(renderMethodHelpFromCatalog(showStory));
    expect(reference).not.toContain(renderMethodHelpFromCatalog(show));
  });

  it('also describes the tools its entries name, within the toolsets the text names', () => {
    const toolset = (
      id: string,
      methods: Record<string, string>
    ): ReturnType<typeof toCatalogEntry> =>
      toCatalogEntry(
        defineToolset({
          id,
          description: `${id} tools.`,
          methods: Object.fromEntries(
            Object.entries(methods).map(([name, description]) => [
              name,
              { title: name, description, input: v.object({}), handler },
            ])
          ),
        }),
        { transport: 'cli', getService: () => ({}) as never }
      );
    const chained = toolset('docs', {
      list: 'List components. Then call `npx storybook tools docs show`.',
      show: 'Show one component. For one story, use `npx storybook tools docs show-story`.',
      showStory: 'Show one story.',
    });
    const review = toolset('review', {
      create: 'Create a review. Find ids with `npx storybook tools docs list`.',
    });
    const described = (text: string) =>
      [
        ...renderCommandReference(text, [chained, review]).matchAll(
          /^Usage: npx storybook tools (.+) \[--key value \.\.\.\]$/gm
        ),
      ].map(([, command]) => command);

    expect(described('Call `npx storybook tools docs list`.')).toEqual([
      'docs list',
      'docs show',
      'docs show-story',
    ]);
    expect(described('Call `npx storybook tools review create`.')).toEqual(['review create']);
  });

  it('is empty when the text names no tool', () => {
    expect(renderCommandReference('Run `npx storybook tools --help`.', [docs])).toBe('');
  });
});
