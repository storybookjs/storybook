import { Option, type Command } from 'commander';

import type { CommandFailureHandler, ToolsPassthroughOptions } from './action.ts';
import { TOOLS_OPTION_SPECS } from './tool-tokens.ts';

export type { CommandFailureHandler } from './action.ts';

/**
 * Register the `storybook tools` passthrough: a generic `[toolset] [tool] [args...]` argument
 * triple that runs the toolsets registered by the target Storybook configuration. Attach is the
 * default when a matching instance is running; `--no-attach` forces a local host.
 * `passThroughOptions` hands every token after the tool name to the tool untouched, which requires
 * positional options on the program.
 *
 * Commander's built-in (synchronous) help is replaced with our own `-h, --help` option so the help
 * output can be derived from the toolsets the target project registers. Target-selection options
 * (`--cwd`, `--config-dir`) belong before the toolset name; the output flags (`--json`,
 * `--input`, `--output`, `--help`) are accepted on both sides of it.
 *
 * The action is imported when it runs, so registering the command loads no tools or server code.
 */
export function registerToolsPassthrough(
  program: Command,
  toolsCommand: Command,
  handleCommandFailure: CommandFailureHandler
): void {
  program.enablePositionalOptions();

  toolsCommand
    .helpOption(false)
    .usage('[options] [toolset] [tool] [args...]')
    .argument('[toolset]', 'A toolset provided by the target Storybook configuration')
    .argument('[tool]', "One of the toolset's tools, e.g. `stories find-by-component`")
    .argument(
      '[args...]',
      'Tool arguments as `--key value` flags; values are JSON-parsed when possible'
    );

  for (const { flags, description } of TOOLS_OPTION_SPECS) {
    if (flags === '--no-attach') {
      const option = new Option(flags, description);
      // Commander treats `--no-*` as the negation of `--*`, which would default `--attach` to true.
      option.negate = false;
      toolsCommand.addOption(option);
      continue;
    }
    toolsCommand.option(flags, description);
  }

  toolsCommand
    .passThroughOptions()
    .action(
      async (
        toolset: string | undefined,
        tool: string | undefined,
        tokens: string[],
        options: ToolsPassthroughOptions
      ): Promise<void> => {
        const { runToolsAction } = await import('./action.ts');
        await runToolsAction(toolset, tool, tokens, options, handleCommandFailure);
      }
    );
}
