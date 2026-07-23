import { HandledError } from 'storybook/internal/common';

import type { Command } from 'commander';

import { invokeApi, type AnyApiDefinition } from '../../shared/public-api/index.ts';
import { parseToolArgs } from '../ai/mcp/tool-args.ts';

export function generateCLI(
  toolsCommand: Command,
  apiDefinitions: readonly AnyApiDefinition[],
  { beforeRun }: { beforeRun?: () => Promise<void> | void } = {}
): void {
  toolsCommand.parent?.enablePositionalOptions();
  toolsCommand.enablePositionalOptions();

  const sortedApiDefinitions = [...apiDefinitions].sort((a, b) => a.id.localeCompare(b.id));
  const apiIdsByCommandName = new Map<string, string>();
  for (const definition of sortedApiDefinitions) {
    const commandName = toCliServiceName(definition.id);
    if (apiIdsByCommandName.has(commandName)) {
      throw new TypeError(
        `Public APIs "${apiIdsByCommandName.get(commandName)}" and "${definition.id}" normalize to the same CLI group "${commandName}".`
      );
    }
    apiIdsByCommandName.set(commandName, definition.id);
  }

  for (const definition of sortedApiDefinitions) {
    const commandName = toCliServiceName(definition.id);
    const apiCommand = toolsCommand
      .command(commandName)
      .description(definition.description ?? definition.id)
      .enablePositionalOptions();

    const methodNames = Object.keys(definition.methods).sort((a, b) => a.localeCompare(b));
    const commandNames = new Set<string>();
    for (const methodName of methodNames) {
      const commandName = toKebabCase(methodName);
      if (commandNames.has(commandName)) {
        throw new TypeError(
          `Public API "${definition.id}" has methods that normalize to the same CLI command "${commandName}".`
        );
      }
      commandNames.add(commandName);
      addOperation(apiCommand, definition, methodName, beforeRun);
    }
  }
}

function addOperation(
  apiCommand: Command,
  definition: AnyApiDefinition,
  methodName: string,
  beforeRun: (() => Promise<void> | void) | undefined
): void {
  apiCommand
    .command(toKebabCase(methodName))
    .description(definition.methods[methodName].description ?? methodName)
    .argument('[args...]', "Operation input as --key value flags (or via --input '<object>')")
    .allowUnknownOption()
    .passThroughOptions()
    .action(async (tokens: string[]) => {
      await beforeRun?.();
      // `--json` is a normal boolean flag here (method schemas expose it), so the raw-object escape
      // hatch moves to `--input '<object>'` to avoid clobbering it.
      const parsed = parseToolArgs(tokens, {}, { rawObjectFlag: 'input' });
      if (!parsed.ok) {
        throw new HandledError(parsed.error);
      }
      // Always pass the parsed object (empty when no flags) so all-optional object schemas validate
      // and apply their defaults; a method with no input uses an empty object schema, not `undefined`.
      const result = await invokeApi(definition, methodName, parsed.args, { consumer: 'cli' });
      const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

      if (output !== undefined) {
        process.stdout.write(`${output}\n`);
      }
    });
}

function toCliServiceName(serviceId: string): string {
  return serviceId.startsWith('core/') ? serviceId.slice('core/'.length) : serviceId;
}

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}
