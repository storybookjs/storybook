import * as v from 'valibot';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { clearRegistry, getService, registerService } from '../../shared/open-service/server.ts';
import { defineService } from '../../shared/open-service/service-definition.ts';
import { generateCLI } from './generate-cli.ts';

/** Fixture service — not the real `core/docs` capability contract. */
const exampleServiceDef = defineService({
  id: 'core/example',
  description: 'Example tools for generateCLI tests.',
  initialState: {
    documents: {
      button: { id: 'button', title: 'Button' },
    } as Record<string, { id: string; title: string }>,
  },
  queries: {
    getDocumentation: {
      description: 'Gets documentation by id.',
      input: v.object({ id: v.string() }),
      output: v.optional(v.object({ id: v.string(), title: v.string() })),
      handler: ({ id }, ctx) => ctx.self.state.documents[id],
    },
    _internalDocuments: {
      internal: true,
      input: v.undefined(),
      output: v.record(v.string(), v.object({ id: v.string(), title: v.string() })),
      handler: (_input, ctx) => ctx.self.state.documents,
    },
  },
  commands: {
    clearDocumentation: {
      description: 'Clears all documentation.',
      input: v.undefined(),
      output: v.undefined(),
      handler: async (_input, ctx) => {
        ctx.self.setState((state) => {
          state.documents = {};
        });
        return undefined;
      },
    },
  },
});

function buildProgram(options?: { beforeRun?: () => Promise<void> | void }) {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });

  const toolsCommand = program.command('tools');
  generateCLI(toolsCommand, [exampleServiceDef], options);

  return { program, toolsCommand };
}

afterEach(() => {
  clearRegistry();
  vi.restoreAllMocks();
});

describe('generateCLI', () => {
  it('generates service operations and invokes a query from CLI flags', async () => {
    registerService(exampleServiceDef);
    const { program, toolsCommand } = buildProgram();
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync([
      'node',
      'storybook',
      'tools',
      'example',
      'get-documentation',
      '--id',
      'button',
    ]);

    expect(toolsCommand.commands.map((command) => command.name())).toEqual(['example']);
    expect(toolsCommand.commands[0].commands.map((command) => command.name())).toEqual([
      'get-documentation',
      'clear-documentation',
    ]);
    expect(write).toHaveBeenCalledWith('{\n  "id": "button",\n  "title": "Button"\n}\n');
  });

  it('generates and invokes service commands', async () => {
    registerService(exampleServiceDef);
    const { program } = buildProgram();

    await program.parseAsync(['node', 'storybook', 'tools', 'example', 'clear-documentation']);

    expect(
      getService('core/example').queries.getDocumentation.get({ id: 'button' })
    ).toBeUndefined();
  });

  it('loads services before invoking an operation', async () => {
    const beforeRun = vi.fn(() => {
      registerService(exampleServiceDef);
    });
    const { program } = buildProgram({ beforeRun });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync([
      'node',
      'storybook',
      'tools',
      'example',
      'get-documentation',
      '--id',
      'button',
    ]);

    expect(beforeRun).toHaveBeenCalledOnce();
  });

  it('accepts a JSON object as operation input', async () => {
    registerService(exampleServiceDef);
    const { program } = buildProgram();
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync([
      'node',
      'storybook',
      'tools',
      'example',
      'get-documentation',
      '--json',
      '{"id":"button"}',
    ]);

    expect(write).toHaveBeenCalledWith('{\n  "id": "button",\n  "title": "Button"\n}\n');
  });
});
