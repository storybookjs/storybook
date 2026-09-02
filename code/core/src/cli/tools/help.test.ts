import { describe, expect, it } from 'vitest';

import * as v from 'valibot';

import { defineToolset, type ToolsetCtx } from '../../shared/open-service/toolset-definition.ts';
import { renderMethodHelp, renderToolsHelp, renderToolsetHelp } from './help.ts';

const toolset = defineToolset({
  id: 'example',
  description: 'Example tools.',
  methods: {
    getHTTPFrame: {
      title: 'Inspect an HTTP frame',
      description: `HTTP frame utilities
Use this detailed second line only in the full reference.`,
      input: v.object({}),
      handler: async () => ({ ok: true, data: {}, markdown: '' }),
    },
    preview: {
      title: 'Preview an example',
      description: 'Preview one example.',
      input: v.object({
        id: v.pipe(v.string(), v.description('Example identifier')),
      }),
      output: v.object({
        url: v.pipe(v.string(), v.description('Preview URL')),
      }),
      requiresDevServer: true,
      handler: async ({ id }) => ({
        ok: true,
        data: { url: `http://localhost:6006/${id}` },
        markdown: id,
      }),
    },
  },
});

const ctx: ToolsetCtx = {
  transport: 'cli',
  getService: () => ({}) as never,
};

describe('tools help rendering', () => {
  it('renders the complete root help from toolset contracts', () => {
    expect(renderToolsHelp('/repo/.storybook', [toolset], ctx)).toMatchInlineSnapshot(`
      "Usage: npx storybook tools [options] [toolset] [tool] [args...]

      Storybook tools from the Storybook configuration at /repo/.storybook.

      Options:
        --cwd <path>                 Project directory of the target Storybook
        -c, --config-dir <dir-name>  Storybook config directory of the target Storybook
        -p, --port <number>          Port of a running Storybook; targets that instance directly, no --cwd or --config-dir needed
        --attach                     Require attaching to a running Storybook; gate failures are errors instead of a local fallback
        --no-attach                  Load the project configuration without attaching
        --input <object>             Raw JSON object with the tool arguments (escape hatch for complex values)
        --json                       Print the tool's structured result data as JSON instead of markdown
        -o, --output <path>          Write the result to a file instead of stdout
        -h, --help                   Show every tool of the target Storybook, or one tool with its arguments

      Commands:
        example get-http-frame  Inspect an HTTP frame  [local]
        example preview         Preview an example  [requires running Storybook]

      [local] tools run without a running Storybook.
      [requires running Storybook] tools need a running Storybook dev server; start it first.
      Tool results print as markdown; the Output blocks below describe the \`--json\` data.
      Individual \`--key value\` flags override entries of \`--input\`.

      Tool reference — every command in full (\`npx storybook tools <toolset> <tool> --help\` shows one alone):

      example — Example tools.

        example get-http-frame  [local]

          HTTP frame utilities
          Use this detailed second line only in the full reference.

          Arguments: none.

        example preview  [requires running Storybook]

          Preview one example.

          Arguments:
          - \`--id\` (string, required): Example identifier

          Output (\`--json\`):
          - \`url\` (string, required): Preview URL"
    `);
  });

  it('renders one toolset exactly', () => {
    expect(renderToolsetHelp(toolset, ctx)).toMatchInlineSnapshot(`
      "Usage: npx storybook tools example <tool> [--key value ...]

      example — Example tools.

        example get-http-frame  [local]

          HTTP frame utilities
          Use this detailed second line only in the full reference.

          Arguments: none.

        example preview  [requires running Storybook]

          Preview one example.

          Arguments:
          - \`--id\` (string, required): Example identifier

          Output (\`--json\`):
          - \`url\` (string, required): Preview URL"
    `);
  });

  it('renders one method with its input and output contracts', () => {
    expect(renderMethodHelp(toolset, 'preview', toolset.methods.preview, ctx))
      .toMatchInlineSnapshot(`
      "Usage: npx storybook tools example preview [--key value ...]

      Execution: requires a running Storybook dev server; start it first.

      Preview one example.

      Arguments:
      - \`--id\` (string, required): Example identifier

      Output (\`--json\`):
      - \`url\` (string, required): Preview URL"
    `);
  });
});
