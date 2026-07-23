import { afterEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import * as v from 'valibot';

import { defineApi, type AnyApiDefinition } from '../../shared/public-api/index.ts';
import { generateCLI } from './generate-cli.ts';

const docsApi = defineApi({
  id: 'docs',
  description: 'Documentation tools.',
  methods: {
    getDocumentation: {
      description: 'Gets documentation by id.',
      schema: v.object({ id: v.string() }),
      handler: async ({ id }, { consumer }) => `${consumer}: ${id}`,
    },
    listComponents: {
      description: 'Lists components.',
      schema: v.object({}),
      handler: async () => ({ components: ['Button'] }),
    },
  },
});

const reviewApi = defineApi({
  id: 'review',
  description: 'Review tools.',
  methods: {
    create: {
      description: 'Creates a review.',
      schema: v.object({ storyIds: v.array(v.string()) }),
      handler: async ({ storyIds }) => ({ storyIds }),
    },
  },
});

function buildProgram(
  apiDefinitions: readonly AnyApiDefinition[] = [docsApi],
  options?: { beforeRun?: () => Promise<void> | void }
) {
  const program = new Command();
  program.exitOverride();
  program.configureOutput({ writeOut: () => {}, writeErr: () => {} });

  const toolsCommand = program.command('tools');
  generateCLI(toolsCommand, apiDefinitions, options);

  return { program, toolsCommand };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateCLI', () => {
  it('generates commands only for explicitly selected APIs', () => {
    const { toolsCommand } = buildProgram([docsApi]);

    expect(toolsCommand.commands.map((command) => command.name())).toEqual(['docs']);
  });

  it('orders API groups and method commands deterministically', () => {
    const { toolsCommand } = buildProgram([reviewApi, docsApi]);

    expect(toolsCommand.commands.map((command) => command.name())).toEqual(['docs', 'review']);
    expect(toolsCommand.commands[0].commands.map((command) => command.name())).toEqual([
      'get-documentation',
      'list-components',
    ]);
  });

  it('rejects API ids that normalize to the same CLI group', () => {
    const coreDocsApi = defineApi({
      id: 'core/docs',
      description: 'Core documentation tools.',
      methods: {},
    });

    expect(() => buildProgram([docsApi, coreDocsApi])).toThrow(
      'Public APIs "core/docs" and "docs" normalize to the same CLI group "docs".'
    );
  });

  it('rejects empty API ids that normalize to the same CLI group', () => {
    const emptyApi = defineApi({
      id: '',
      description: 'Empty API tools.',
      methods: {},
    });
    const coreEmptyApi = defineApi({
      id: 'core/',
      description: 'Core empty API tools.',
      methods: {},
    });

    expect(() => buildProgram([emptyApi, coreEmptyApi])).toThrow(
      'Public APIs "" and "core/" normalize to the same CLI group "".'
    );
  });

  it('invokes methods from raw CLI flags and prints string results directly', async () => {
    const { program, toolsCommand } = buildProgram();
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync([
      'node',
      'storybook',
      'tools',
      'docs',
      'get-documentation',
      '--id',
      'button',
    ]);

    expect(toolsCommand.commands.map((command) => command.name())).toEqual(['docs']);
    expect(write).toHaveBeenCalledWith('cli: button\n');
  });

  it('JSON-stringifies structured method results', async () => {
    const { program } = buildProgram();
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'storybook', 'tools', 'docs', 'list-components']);

    expect(write).toHaveBeenCalledWith('{\n  "components": [\n    "Button"\n  ]\n}\n');
  });

  it('runs beforeRun before invoking the selected method', async () => {
    const events: string[] = [];
    const api = defineApi({
      id: 'events',
      description: 'Event tools.',
      methods: {
        run: {
          description: 'Records a method invocation.',
          schema: v.object({}),
          handler: async () => {
            events.push('method');
          },
        },
      },
    });
    const beforeRun = vi.fn(() => {
      events.push('beforeRun');
    });
    const { program } = buildProgram([api], { beforeRun });
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'storybook', 'tools', 'events', 'run']);

    expect(beforeRun).toHaveBeenCalledOnce();
    expect(events).toEqual(['beforeRun', 'method']);
  });

  it('validates parsed flags before calling the method', async () => {
    const handler = vi.fn(async () => '# should not run');
    const api = defineApi({
      id: 'validation',
      description: 'Validation tools.',
      methods: {
        show: {
          description: 'Shows a component.',
          schema: v.object({ id: v.string() }),
          handler,
        },
      },
    });
    const { program } = buildProgram([api]);

    await expect(
      program.parseAsync(['node', 'storybook', 'tools', 'validation', 'show', '--id', '42'])
    ).rejects.toThrow('Public API input validation failed.');

    expect(handler).not.toHaveBeenCalled();
  });

  it('propagates method errors', async () => {
    const error = new Error('method failed');
    const api = defineApi({
      id: 'errors',
      description: 'Error tools.',
      methods: {
        fail: {
          description: 'Fails.',
          schema: v.object({}),
          handler: async () => {
            throw error;
          },
        },
      },
    });
    const { program } = buildProgram([api]);

    await expect(program.parseAsync(['node', 'storybook', 'tools', 'errors', 'fail'])).rejects.toBe(
      error
    );
  });

  it('rejects method names that collide after kebab-case normalization', () => {
    const api = defineApi({
      id: 'collisions',
      description: 'Collision tools.',
      methods: {
        showStory: {
          description: 'Shows a story.',
          schema: v.undefined(),
          handler: async () => undefined,
        },
        'show-story': {
          description: 'Shows a dashed story.',
          schema: v.undefined(),
          handler: async () => undefined,
        },
      },
    });

    expect(() => buildProgram([api])).toThrow(
      'Public API "collisions" has methods that normalize to the same CLI command "show-story".'
    );
  });

  it('passes an empty object for no-flag calls so all-optional object schemas validate', async () => {
    let received: unknown;
    const api = defineApi({
      id: 'options',
      description: 'All-optional tools.',
      methods: {
        list: {
          description: 'Lists with optional flags.',
          schema: v.object({
            verbose: v.optional(v.boolean(), false),
            limit: v.optional(v.number()),
          }),
          handler: async (input) => {
            received = input;
            return input;
          },
        },
      },
    });
    const { program } = buildProgram([api]);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync(['node', 'storybook', 'tools', 'options', 'list']);

    // A no-flag call must reach the handler with `{}` (defaults applied), not `undefined` (which an
    // all-optional object schema rejects).
    expect(received).toEqual({ verbose: false });
  });

  it('exposes the method-level `json` boolean as a bare `--json` flag', async () => {
    let received: unknown;
    const api = defineApi({
      id: 'docs',
      description: 'Documentation tools.',
      methods: {
        show: {
          description: 'Shows a component.',
          schema: v.object({
            id: v.string(),
            json: v.optional(v.boolean(), false),
          }),
          handler: async (input) => {
            received = input;
            return input;
          },
        },
      },
    });
    const { program } = buildProgram([api]);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync([
      'node',
      'storybook',
      'tools',
      'docs',
      'show',
      '--id',
      'Button',
      '--json',
    ]);

    expect(received).toEqual({ id: 'Button', json: true });
  });

  it('accepts structured input through the `--input` escape flag', async () => {
    let received: unknown;
    const api = defineApi({
      id: 'docs',
      description: 'Documentation tools.',
      methods: {
        show: {
          description: 'Shows a component.',
          schema: v.object({
            id: v.string(),
            json: v.optional(v.boolean(), false),
          }),
          handler: async (input) => {
            received = input;
            return input;
          },
        },
      },
    });
    const { program } = buildProgram([api]);
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await program.parseAsync([
      'node',
      'storybook',
      'tools',
      'docs',
      'show',
      '--input',
      '{"id":"Button","json":true}',
    ]);

    expect(received).toEqual({ id: 'Button', json: true });
  });

  it('surfaces actionable Standard Schema detail in validation errors', async () => {
    const api = defineApi({
      id: 'validation',
      description: 'Validation tools.',
      methods: {
        show: {
          description: 'Shows a component.',
          schema: v.object({ id: v.string() }),
          handler: async () => '# should not run',
        },
      },
    });
    const { program } = buildProgram([api]);

    await expect(
      program.parseAsync(['node', 'storybook', 'tools', 'validation', 'show', '--id', '42'])
    ).rejects.toThrow(/id: /);
  });
});
