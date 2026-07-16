import { HandledError } from 'storybook/internal/common';

import type { Command } from 'commander';

import { getService } from '../../shared/open-service/server.ts';
import type { AnyServiceDefinition, RuntimeService } from '../../shared/open-service/types.ts';
import { parseToolArgs } from '../ai/mcp/tool-args.ts';

export function generateCLI(
  toolsCommand: Command,
  serviceDefinitions: readonly AnyServiceDefinition[],
  { beforeRun }: { beforeRun?: () => Promise<void> | void } = {}
): void {
  toolsCommand.parent?.enablePositionalOptions();
  toolsCommand.enablePositionalOptions();

  for (const definition of serviceDefinitions) {
    const serviceCommand = toolsCommand
      .command(toCliServiceName(definition.id))
      .description(definition.description ?? definition.id)
      .enablePositionalOptions();

    for (const [name, query] of Object.entries(definition.queries)) {
      if (!query.internal) {
        addOperation(serviceCommand, definition, name, query.description, 'query', beforeRun);
      }
    }
    for (const [name, command] of Object.entries(definition.commands)) {
      if (!command.internal) {
        addOperation(serviceCommand, definition, name, command.description, 'command', beforeRun);
      }
    }
  }
}

function addOperation(
  serviceCommand: Command,
  definition: AnyServiceDefinition,
  operationName: string,
  description: string | undefined,
  kind: 'query' | 'command',
  beforeRun: (() => Promise<void> | void) | undefined
): void {
  serviceCommand
    .command(toKebabCase(operationName))
    .description(description ?? operationName)
    .argument('[args...]', 'Operation input as --key value flags')
    .allowUnknownOption()
    .passThroughOptions()
    .action(async (tokens: string[]) => {
      await beforeRun?.();
      const parsed = parseToolArgs(tokens);
      if (!parsed.ok) {
        throw new HandledError(parsed.error);
      }
      const input = Object.keys(parsed.args).length === 0 ? undefined : parsed.args;
      const service = getService<RuntimeService>(definition.id);
      const result =
        kind === 'query'
          ? await service.queries[operationName].loaded(input)
          : await service.commands[operationName](input);
      const output = JSON.stringify(result, null, 2);

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
