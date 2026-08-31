/**
 * The primary seam of the `storybook tools` CLI: tokens in, `{ exitCode, output }` out, against a
 * toolset registry populated with the real core toolsets (stub dependencies). Exercises dispatch,
 * help, argument parsing and validation, the requires-dev-server contract, and outcome mapping —
 * everything behind the commander wiring, without spawning processes.
 */

import type { StoryIndex } from 'storybook/internal/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as v from 'valibot';

import { Tag } from '../../shared/constants/tags.ts';
import { defineToolset, type ToolsetCtx } from '../../shared/open-service/toolset-definition.ts';
import {
  clearToolsetRegistry,
  getRegisteredToolsets,
  getToolset,
  registerToolset,
} from '../../shared/open-service/toolset-registry.ts';
import type { DocsAccess } from '../../shared/open-service/toolsets/docs/access.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import { runToolsCommand, type ToolsInvocation, type ToolsRunDeps } from './run.ts';
import { parseToolsetMethodId } from '../../shared/open-service/toolset-names.ts';
import { toCatalogEntry } from './sdk/catalog.ts';
import {
  AttachUnavailableError,
  ToolsRuntimeError,
  type AttachedTools,
  type LocalTools,
  type ToolsRuntime,
} from './sdk/index.ts';
import { registerCoreToolsetsForTest } from './test-support/register-core-toolsets.ts';

const CONFIG_DIR = '/repo/.storybook';

const STORY_INDEX = {
  v: 5,
  entries: {
    'button--primary': {
      id: 'button--primary',
      title: 'Button',
      name: 'Primary',
      importPath: './src/Button.stories.tsx',
      type: 'story',
      subtype: 'story',
      componentPath: './src/Button.tsx',
      tags: [Tag.MANIFEST],
    },
  },
} as unknown as StoryIndex;

const DOCS_ACCESS: DocsAccess = {
  list: async () => ({
    componentManifest: {
      v: 1,
      components: {
        button: { id: 'button', name: 'Button', path: 'src/Button.tsx' },
      },
    },
  }),
  resolve: async () => undefined,
};

const RECORD: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'abc',
  pid: 123,
  cwd: '/repo',
  configDir: CONFIG_DIR,
  url: 'http://localhost:6006',
  port: 6006,
  mcp: { status: 'not-installed' },
};

function makeLocalTools(runtimeOverrides: Partial<ToolsRuntime> = {}): LocalTools {
  const runtime: ToolsRuntime = {
    configDir: CONFIG_DIR,
    toolsets: getRegisteredToolsets(),
    getService: () => {
      throw new Error('no services registered in this test');
    },
    close: async () => {},
    ...runtimeOverrides,
  };
  const ctx: ToolsetCtx = { transport: 'cli', getService: runtime.getService };
  const storybook = { version: '0.0.0', configDir: runtime.configDir };
  return {
    mode: 'local',
    requestedMode: 'local',
    host: 'in-process',
    clientInfo: { name: 'storybook-cli', version: '0.0.0', kind: 'cli' },
    runtime,
    storybook,
    describe: async (options) => {
      const toolsets =
        options?.toolset === undefined
          ? runtime.toolsets
          : runtime.toolsets.filter((toolset) => toolset.id === options.toolset);
      return {
        configDir: runtime.configDir,
        toolsets: toolsets.map((toolset) => toCatalogEntry(toolset, ctx)),
      };
    },
    call: async (ref, input, options = {}) => {
      const { toolsetId, methodName } = parseToolsetMethodId(ref);
      const toolset = runtime.toolsets.find((candidate) => candidate.id === toolsetId);
      const method = toolset?.methods[methodName];
      if (!method) {
        throw new Error(`Unknown tool \`${ref}\`.`);
      }
      const validation = await method.input['~standard'].validate(input ?? {});
      if (validation.issues) {
        throw new ToolsRuntimeError({
          reason: 'invalid-input',
          message: `Invalid input for \`${ref}\``,
          issues: validation.issues,
        });
      }
      return method.handler(validation.value, {
        ...ctx,
        ...(options.origin ? { origin: options.origin } : {}),
        ...(options.telemetry ? { telemetry: options.telemetry } : {}),
      });
    },
    close: async () => {},
  };
}

function makeDeps(overrides: Partial<ToolsRunDeps> & { runtime?: Partial<ToolsRuntime> } = {}) {
  const { runtime: runtimeOverrides, ...deps } = overrides;
  const createTools = deps.createTools ?? vi.fn(async () => makeLocalTools(runtimeOverrides));
  const discoverInstance =
    deps.discoverInstance ?? vi.fn(async () => ({ currentRecord: undefined, records: [] }));
  return { deps: { ...deps, createTools, discoverInstance }, createTools, discoverInstance };
}

function makeAttachedTools(runtimeOverrides: Partial<ToolsRuntime> = {}): AttachedTools {
  const local = makeLocalTools(runtimeOverrides);
  const origin = 'http://localhost:6006';
  const ctx: ToolsetCtx = {
    transport: 'cli',
    origin,
    getService: local.runtime.getService,
  };
  return {
    ...local,
    mode: 'attached',
    requestedMode: 'attached',
    host: 'in-process',
    storybook: {
      version: '0.0.0',
      configDir: CONFIG_DIR,
      url: origin,
      pid: 123,
    },
    describe: async (options) => {
      const toolsets =
        options?.toolset === undefined
          ? local.runtime.toolsets
          : local.runtime.toolsets.filter((toolset) => toolset.id === options.toolset);
      return {
        configDir: local.runtime.configDir,
        toolsets: toolsets.map((toolset) => toCatalogEntry(toolset, ctx)),
      };
    },
    call: async (ref, input, options) => {
      const callCtx: ToolsetCtx = {
        ...ctx,
        ...(options?.origin !== undefined ? { origin: options.origin } : {}),
        ...(options?.telemetry ? { telemetry: options.telemetry } : {}),
      };
      const { toolsetId, methodName } = parseToolsetMethodId(ref);
      const toolset = local.runtime.toolsets.find((candidate) => candidate.id === toolsetId);
      const method = toolset?.methods[methodName];
      if (!method) {
        throw new Error(`Unknown tool \`${ref}\`.`);
      }
      const validation = await method.input['~standard'].validate(input ?? {});
      if (validation.issues) {
        throw new ToolsRuntimeError({
          reason: 'invalid-input',
          message: `Invalid input for \`${ref}\``,
          issues: validation.issues,
        });
      }
      return method.handler(validation.value, callCtx);
    },
  };
}

function run(argv: string[], deps: ToolsRunDeps, extra: Partial<ToolsInvocation> = {}) {
  const [toolset, tool, ...tokens] = argv;
  return runToolsCommand({ toolset, tool, tokens, target: {}, ...extra }, deps);
}

beforeEach(() => {
  registerCoreToolsetsForTest({ index: STORY_INDEX, docsAccess: DOCS_ACCESS });
});

describe('local tools', () => {
  it('runs docs list without a dev server and prints exactly the markdown MCP clients receive', async () => {
    const { deps } = makeDeps();

    const result = await run(['docs', 'list'], deps);

    // Parity claim: the CLI must print byte-for-byte what MCP clients receive. The MCP adapter
    // itself lives in addon-mcp (core tests cannot reach it); its own suite asserts it renders
    // handler markdown verbatim as text blocks, so comparing against the handler's markdown under
    // an MCP context is the same contract expressed from this side of the package boundary.
    const mcpCtx: ToolsetCtx = { transport: 'mcp', getService: () => ({}) as never };
    const mcpOutcome = await getToolset('docs').methods.list.handler({}, mcpCtx);
    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'success' });
    expect(result.output).toContain('Button');
    expect(result.output).toBe(mcpOutcome.markdown);
  });

  it('stamps tools-command dimensions onto per-method telemetry for a local host', async () => {
    const methodTelemetry = vi.fn(async () => {});
    const { deps } = makeDeps({ methodTelemetry });

    const result = await run(['docs', 'list'], deps);

    expect(result.outcome).toEqual({ kind: 'success' });
    expect(methodTelemetry).toHaveBeenCalledWith(
      'tool:listAllDocumentation',
      expect.objectContaining({
        toolset: 'docs',
        client: 'cli',
        requestedMode: 'local',
        resolvedMode: 'local',
        attachMode: 'local',
        host: 'in-process',
      })
    );
  });

  it('prints the structured result data with --json', async () => {
    const { deps } = makeDeps();

    const result = await run(['docs', 'list', '--json'], deps);

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.output);
    expect(data.manifests.componentManifest.components.button.name).toBe('Button');
  });

  it('runs stories changed against the in-process module graph when it is ready', async () => {
    const moduleGraph = {
      queries: {
        status: { loaded: async () => ({ value: 'ready' }) },
        storiesForFiles: { loaded: async () => [] },
      },
    };
    const { deps } = makeDeps({
      runtime: {
        getService: () => moduleGraph as never,
      },
    });

    const result = await run(['stories', 'changed'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('No new, modified, or related stories detected.');
  });

  it('fails graph tools with the typed unavailable error when the builder has no adapter', async () => {
    const moduleGraph = {
      queries: {
        status: {
          loaded: async () => ({
            value: 'unavailable',
            reason: 'builder does not support change detection',
          }),
        },
        storiesForFiles: { loaded: async () => [] },
      },
    };
    const { deps } = makeDeps({
      runtime: {
        getService: () => moduleGraph as never,
      },
    });

    const result = await run(
      ['stories', 'find-by-component', '--componentPaths', '["/x.tsx"]'],
      deps
    );

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'failure' });
    expect(result.output).toContain('builder does not support change detection');
  });

  it('lets addon toolsets use the hosted module graph without a core method allowlist', async () => {
    const moduleGraph = {
      queries: { status: { loaded: async () => ({ value: 'ready' }) } },
    };
    clearToolsetRegistry();
    registerToolset(
      defineToolset({
        id: 'addon',
        description: 'Addon tools.',
        methods: {
          graphStatus: {
            title: 'Read graph status',
            description: 'Read the module graph status.',
            input: v.object({}),
            handler: async (_input, ctx) => {
              const service = ctx.getService<typeof moduleGraph>('core/module-graph', {
                internal: true,
              });
              const data = await service.queries.status.loaded();
              return { ok: true as const, data, markdown: data.value };
            },
          },
        },
      })
    );
    const { deps } = makeDeps({
      runtime: { getService: () => moduleGraph as never },
    });

    const result = await run(['addon', 'graph-status'], deps);

    expect(result).toMatchObject({ exitCode: 0, output: 'ready' });
  });

  it('hosts the run on an SDK instance for the targeted project, identified as the CLI', async () => {
    const { deps, createTools } = makeDeps();

    await runToolsCommand(
      {
        toolset: 'docs',
        tool: 'list',
        tokens: [],
        target: { cwd: '/repo', configDir: '.storybook' },
      },
      deps
    );

    expect(createTools).toHaveBeenCalledWith({
      cwd: '/repo',
      configDir: '.storybook',
      mode: 'auto',
      clientInfo: { name: 'storybook-cli', version: expect.any(String), kind: 'cli' },
    });
  });

  it('threads a valid --port to the SDK host', async () => {
    const { deps, createTools } = makeDeps();

    await runToolsCommand(
      { toolset: 'docs', tool: 'list', tokens: [], target: { cwd: '/repo' }, port: '6006' },
      deps
    );

    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ port: 6006 }));
  });

  it('preserves a port given directly on the target when no raw --port value exists', async () => {
    const { deps, createTools } = makeDeps();

    await runToolsCommand(
      { toolset: 'docs', tool: 'list', tokens: [], target: { cwd: '/repo', port: 6006 } },
      deps
    );

    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ port: 6006 }));
  });

  it('rejects an invalid --port before creating any host', async () => {
    const { deps, createTools } = makeDeps();

    const result = await runToolsCommand(
      { toolset: 'docs', tool: 'list', tokens: [], target: {}, port: 'abc' },
      deps
    );

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
    expect(result.output).toContain('`--port` must be a port number');
    expect(createTools).not.toHaveBeenCalled();
  });

  it('carries a multi-instance notice out of band when the attached host reports siblings', async () => {
    const attached = makeAttachedTools();
    attached.storybook.siblings = [
      { url: 'http://localhost:6008', port: 6008, pid: 456, cwd: '/repo' },
    ];
    const { deps } = makeDeps({ createTools: vi.fn(async () => attached) });

    const result = await run(['docs', 'list'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.multiInstanceNotice).toContain('http://localhost:6006');
    expect(result.multiInstanceNotice).toContain('http://localhost:6008');
    expect(result.multiInstanceNotice).toContain('--port');
    expect(result.output).not.toContain('http://localhost:6008');
  });

  it('reports no multi-instance notice when the attached host has no siblings', async () => {
    const { deps } = makeDeps({ createTools: vi.fn(async () => makeAttachedTools()) });

    const result = await run(['docs', 'list'], deps);

    expect(result.multiInstanceNotice).toBeUndefined();
  });
});

describe('requires-dev-server contract', () => {
  it('intercepts stories preview with one uniform message when nothing is running', async () => {
    const { deps } = makeDeps();

    const result = await run(
      ['stories', 'preview', '--stories', '[{"storyId":"button--primary"}]'],
      deps
    );

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'requires-dev-server' });
    expect(result.output).toContain('requires a running Storybook dev server');
  });

  it('hands the parsed --port to instance discovery so the message names the right instance', async () => {
    const { deps, discoverInstance } = makeDeps();

    await runToolsCommand(
      {
        toolset: 'stories',
        tool: 'preview',
        tokens: ['--stories', '[{"storyId":"button--primary"}]'],
        target: { cwd: '/repo' },
        port: '6006',
        attach: false,
      },
      deps
    );

    expect(discoverInstance).toHaveBeenCalledWith({ cwd: '/repo', port: 6006 });
  });

  it('lists running instances of other projects in the no-instance guidance', async () => {
    const { deps } = makeDeps({
      discoverInstance: vi.fn(async () => ({ currentRecord: undefined, records: [RECORD] })),
    });

    const result = await run(
      ['stories', 'preview', '--stories', '[{"storyId":"button--primary"}]'],
      deps
    );

    expect(result.output).toContain('http://localhost:6006');
    expect(result.output).toContain('--cwd');
  });

  it('intercepts stories preview in local mode even when an instance is running', async () => {
    const { deps } = makeDeps({
      discoverInstance: vi.fn(async () => ({ currentRecord: RECORD, records: [RECORD] })),
    });

    const result = await run(
      ['stories', 'preview', '--stories', '[{"storyId":"button--primary"}]'],
      deps,
      { attach: false }
    );

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'requires-dev-server' });
    expect(result.output).toContain('http://localhost:6006');
    expect(result.output).toContain('--no-attach');
  });

  it('reports state-bound tools as requiring an attached host when an instance is running locally', async () => {
    clearToolsetRegistry();
    registerToolset(
      defineToolset({
        id: 'foreign',
        description: 'Toolset whose method needs dev-server state the CLI cannot reach.',
        methods: {
          attach: {
            title: 'Attach',
            input: v.object({}),
            description: 'attach',
            requiresDevServer: true,
            handler: async () => ({ ok: true as const, data: {}, markdown: '' }),
          },
        },
      })
    );
    const { deps } = makeDeps({
      discoverInstance: vi.fn(async () => ({ currentRecord: RECORD, records: [RECORD] })),
    });

    const result = await run(['foreign', 'attach'], deps, { attach: false });

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'requires-dev-server' });
    expect(result.output).toContain('http://localhost:6006');
    expect(result.output).toContain('--no-attach');
  });

  it('gives state-bound tools the same start-the-dev-server message when nothing is running', async () => {
    const { deps } = makeDeps();

    const result = await run(['review', 'create', '--input', '{}'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'requires-dev-server' });
    expect(result.output).toContain('requires a running Storybook dev server');
  });
});

describe('dispatch', () => {
  it('rejects an unknown toolset with the list the project actually provides', async () => {
    const { deps } = makeDeps();

    const result = await run(['nope', 'list'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-toolset' });
    expect(result.output).toContain('`stories`');
    expect(result.output).toContain('`docs`');
  });

  it('rejects an unknown tool with the toolset’s tools in CLI spelling', async () => {
    const { deps } = makeDeps();

    const result = await run(['stories', 'nope'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-tool' });
    expect(result.output).toContain('`find-by-component`');
  });

  it('reports invalid arguments with a pointer at the tool help', async () => {
    const { deps } = makeDeps();

    const result = await run(['docs', 'show'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'invalid-arguments' });
    expect(result.output).toContain('Invalid arguments for `npx storybook tools docs show`');
    expect(result.output).toContain('--help');
  });

  it('leaves the test toolset out when the project does not register it', async () => {
    // Core harness never registers addon-vitest's `test` toolset.
    registerCoreToolsetsForTest();
    const { deps } = makeDeps();

    const result = await run(['test', 'run'], deps);

    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'unknown-toolset' });
  });
});

describe('help', () => {
  it('renders the full discovery dump with badges, schemas and CLI spellings', async () => {
    const { deps } = makeDeps();

    const result = await runToolsCommand({ tokens: [], target: {} }, deps);

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(result.output).toContain(
      `Storybook tools from the Storybook configuration at ${CONFIG_DIR}`
    );
    // The generic flags are documented in the dump itself: commander's own help is disabled in
    // favor of this runtime-derived one, so nothing else renders them.
    expect(result.output).toContain(
      'Usage: npx storybook tools [options] [toolset] [tool] [args...]'
    );
    expect(result.output).toContain('--cwd <path>');
    expect(result.output).toContain('-c, --config-dir <dir-name>');
    expect(result.output).toContain('-o, --output <path>');
    // The Commands listing summarizes every subcommand commander-style before the full reference.
    expect(result.output).toContain('Commands:');
    expect(result.output).toContain('stories preview  [requires running Storybook]');
    expect(result.output).toContain('docs list  [local]');
    // `test` is owned by addon-vitest; the core harness does not register it.
    expect(result.output).not.toContain('test run');
    expect(result.output).toContain('stories find-by-component');
    // Input schemas come from the valibot definitions.
    expect(result.output).toContain('`--componentPaths`');
    // Declared output schemas are part of the dump.
    expect(result.output).toContain('Output (`--json`):');
  });

  it('renders one toolset’s section with a usage line on a bare toolset name', async () => {
    const { deps } = makeDeps();

    const result = await run(['docs'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(result.output).toContain('Usage: npx storybook tools docs <tool> [--key value ...]');
    expect(result.output).toContain('docs show-story  [local]');
  });

  it('treats `--help` in the tool slot as toolset help, matching `tools docs --help`', async () => {
    const { deps } = makeDeps();

    const result = await run(['docs', '--help'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(result.output).toContain('Usage: npx storybook tools docs <tool> [--key value ...]');
    expect(result.output).not.toContain('Unknown tool');
  });

  it('renders one tool’s help on --help after the tool name', async () => {
    const { deps } = makeDeps();

    const result = await run(['stories', 'preview', '--help'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(result.output).toContain('Usage: npx storybook tools stories preview [--key value ...]');
    expect(result.output).toContain('requires a running Storybook dev server');
    expect(result.output).toContain('`--stories`');
  });

  it('marks non-valibot schemas as not renderable instead of claiming no arguments', async () => {
    const foreignSchema = {
      '~standard': {
        version: 1,
        vendor: 'not-valibot',
        validate: async (value: unknown) => ({ value }),
      },
    };
    clearToolsetRegistry();
    registerToolset(
      defineToolset({
        id: 'foreign',
        description: 'Toolset with a non-valibot standard schema.',
        methods: {
          probe: {
            title: 'Probe',
            input: foreignSchema as never,
            description: 'probe',
            handler: async () => ({ ok: true, data: {}, markdown: '' }),
          },
        },
      })
    );
    const { deps } = makeDeps();

    const result = await run(['foreign', 'probe', '--help'], deps);

    expect(result.output).toContain('could not be rendered');
    expect(result.output).not.toContain('Arguments: none.');
  });

  it('describes tools in CLI vocabulary, never MCP tool names', async () => {
    const { deps } = makeDeps();

    const result = await runToolsCommand({ tokens: [], target: {} }, deps);

    expect(result.output).toContain('npx storybook tools stories changed');
    expect(result.output).not.toContain('stories-changed');
  });
});

describe('outcome mapping', () => {
  beforeEach(() => {
    clearToolsetRegistry();
    registerToolset(
      defineToolset({
        id: 'echo',
        description: 'Test toolset for outcome mapping.',
        methods: {
          ok: {
            title: 'ok',
            input: v.object({}),
            description: 'ok',
            handler: async () => ({ ok: true, data: { a: 1 }, markdown: ['one', 'two'] }),
          },
          bad: {
            title: 'bad',
            input: v.object({}),
            description: 'bad',
            handler: async () => ({ ok: false, data: { a: 0 }, markdown: 'bad news' }),
          },
          boom: {
            title: 'boom',
            input: v.object({}),
            description: 'boom',
            handler: async () => {
              throw new Error('kapow');
            },
          },
          guide: {
            title: 'guide',
            input: v.object({}),
            description: 'guide',
            handler: async () => {
              const error = new Error('Start the dev server, then retry.');
              (error as Error & { agentFacing: boolean }).agentFacing = true;
              throw error;
            },
          },
          input: {
            title: 'input',
            input: v.object({ a: v.optional(v.number()), b: v.optional(v.number()) }),
            description: 'input echo',
            handler: async (input: { a?: number; b?: number }) => ({
              ok: true,
              data: input,
              markdown: JSON.stringify(input),
            }),
          },
        },
      })
    );
  });

  it('joins markdown arrays with blank lines and exits 0 on ok: true', async () => {
    const { deps } = makeDeps();

    const result = await run(['echo', 'ok'], deps);

    expect(result).toMatchObject({
      exitCode: 0,
      output: 'one\n\ntwo',
      outcome: { kind: 'success' },
    });
  });

  it('exits 1 on ok: false while still printing the markdown', async () => {
    const { deps } = makeDeps();

    const result = await run(['echo', 'bad'], deps);

    expect(result).toMatchObject({ exitCode: 1, output: 'bad news', outcome: { kind: 'failure' } });
  });

  it('exits 1 with the message on an unexpected error', async () => {
    const { deps } = makeDeps();

    const result = await run(['echo', 'boom'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.output).toBe('kapow');
    expect(result.outcome).toMatchObject({ kind: 'error' });
  });

  it('surfaces an agent-facing error verbatim as a result, not a crash', async () => {
    const { deps } = makeDeps();

    const result = await run(['echo', 'guide'], deps);

    expect(result).toMatchObject({
      exitCode: 1,
      output: 'Start the dev server, then retry.',
      outcome: { kind: 'failure' },
    });
  });

  it('merges --input with individual flags, flags winning', async () => {
    const { deps } = makeDeps();

    const result = await run(
      ['echo', 'input', '--input', '{"a":1,"b":1}', '--b', '2', '--json'],
      deps
    );

    expect(JSON.parse(result.output)).toEqual({ a: 1, b: 2 });
  });
});

describe('telemetry sink', () => {
  it('forwards per-method events with the toolset’s telemetry group', async () => {
    const methodTelemetry = vi.fn(async () => {});
    const { deps } = makeDeps({ methodTelemetry });

    await run(['docs', 'list'], deps);

    expect(methodTelemetry).toHaveBeenCalledWith(
      'tool:listAllDocumentation',
      expect.objectContaining({ toolset: 'docs' })
    );
  });

  it('forwards per-method events on attached dispatch', async () => {
    const methodTelemetry = vi.fn(async () => {});
    const { deps } = makeDeps({
      methodTelemetry,
      createTools: vi.fn(async () => makeAttachedTools()),
    });

    await run(['docs', 'list'], deps, { attach: true });

    expect(methodTelemetry).toHaveBeenCalledWith(
      'tool:listAllDocumentation',
      expect.objectContaining({ toolset: 'docs' })
    );
  });
});

describe('host failures', () => {
  it('surfaces the SDK’s message when the configuration cannot be loaded', async () => {
    const deps: ToolsRunDeps = {
      createTools: async () => {
        throw new ToolsRuntimeError({
          reason: 'config-load-failed',
          message:
            'Could not load the Storybook configuration for this project: No configuration files found',
        });
      },
    };

    const result = await run(['docs', 'list'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.output).toBe(
      'Could not load the Storybook configuration for this project: No configuration files found'
    );
    expect(result.outcome).toMatchObject({ kind: 'error' });
  });
});

describe('attached tools', () => {
  it('asks the SDK for attached mode', async () => {
    const { deps, createTools } = makeDeps({
      createTools: vi.fn(async () => makeAttachedTools()),
    });

    await run(['docs', 'list'], deps, { attach: true });

    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ mode: 'attached' }));
  });

  it('asks the SDK for local mode with --no-attach', async () => {
    const { deps, createTools } = makeDeps();

    await run(['docs', 'list'], deps, { attach: false });

    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ mode: 'local' }));
  });

  it('dispatches a local child host through describe and call', async () => {
    const tools = makeLocalTools();
    const child: LocalTools = {
      ...tools,
      host: 'child',
      runtime: {
        ...tools.runtime,
        toolsets: [],
      },
    };
    const { deps } = makeDeps({
      createTools: vi.fn(async () => child),
    });

    const result = await run(['docs', 'list'], deps, { attach: false });

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('Button');
  });

  it('intercepts requiresDevServer tools on a local child host with the same guidance as in-process', async () => {
    const tools = makeLocalTools();
    const child: LocalTools = {
      ...tools,
      host: 'child',
      runtime: {
        ...tools.runtime,
        toolsets: [],
      },
    };
    const { deps, discoverInstance } = makeDeps({
      createTools: vi.fn(async () => child),
      discoverInstance: vi.fn(async () => ({ currentRecord: RECORD, records: [RECORD] })),
    });

    const result = await run(
      ['stories', 'preview', '--stories', '[{"storyId":"button--primary"}]'],
      deps,
      { attach: false }
    );

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'requires-dev-server' });
    expect(result.output).toContain('http://localhost:6006');
    expect(result.output).toContain('--no-attach');
    expect(discoverInstance).toHaveBeenCalled();
  });

  it('runs a requiresDevServer tool caller-side with the instance origin, without proxying', async () => {
    clearToolsetRegistry();
    registerToolset(
      defineToolset({
        id: 'foreign',
        description: 'Toolset whose method needs a running Storybook.',
        methods: {
          ping: {
            title: 'Ping',
            input: v.object({}),
            description: 'ping',
            requiresDevServer: true,
            handler: async (_input, ctx) => ({
              ok: true as const,
              data: { origin: ctx.origin },
              markdown: ctx.origin ?? '',
            }),
          },
        },
      })
    );
    const { deps, discoverInstance } = makeDeps({
      createTools: vi.fn(async () => makeAttachedTools()),
    });

    const result = await run(['foreign', 'ping'], deps, { attach: true });

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe('http://localhost:6006');
    expect(discoverInstance).not.toHaveBeenCalled();
  });

  it('prints attach failures as a result when --attach is required', async () => {
    const { deps } = makeDeps({
      createTools: vi.fn(async () => {
        throw new AttachUnavailableError({
          reason: 'no-instance',
          instances: [],
          remediation:
            'No running Storybook was found for this project. Start it first (for example `npm run storybook`), then retry with `--attach`.',
        });
      }),
    });

    const result = await run(['docs', 'list'], deps, { attach: true });

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'attach-gate', reason: 'no-instance' });
    expect(result.requestedMode).toBe('attached');
    expect(result.attachMode).toBe('attached');
    expect(result.output).toContain('npm run storybook');
    expect(result.output).toContain('--attach');
  });

  it('prints the SDK fallback notice separately from the local result', async () => {
    const tools = makeLocalTools();
    tools.fallbackNotice =
      "No running Storybook was found for this project.\n\nFalling back to loading this project's Storybook configuration.";
    tools.requestedMode = 'auto';
    tools.fallbackReason = 'no-instance';
    const { deps, createTools } = makeDeps({
      createTools: vi.fn(async () => tools),
    });

    const result = await run(['docs', 'list'], deps);

    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ mode: 'auto' }));
    expect(result.requestedMode).toBe('auto');
    expect(result.attachMode).toBe('local');
    expect(result.host).toBe('in-process');
    expect(result.fallbackReason).toBe('no-instance');
    expect(result.fallbackNotice).toContain('Falling back to loading this project');
    expect(result.output).toContain('Button');
    expect(result.output).not.toContain('Falling back');
  });

  it('maps catalog failures onto the command runner error contract', async () => {
    const { deps } = makeDeps({
      createTools: vi.fn(async () => ({
        ...makeAttachedTools(),
        describe: async () => {
          throw new ToolsRuntimeError({
            reason: 'connection-lost',
            message: 'The tools child host exited.',
          });
        },
      })),
    });

    const result = await run(['docs', 'list'], deps, { attach: true });

    expect(result.exitCode).toBe(1);
    expect(result.outcome.kind).toBe('error');
    expect(result.output).toContain('The tools child host exited.');
  });
});
