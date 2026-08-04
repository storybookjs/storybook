/**
 * The primary seam of the `storybook tools` CLI: tokens in, `{ exitCode, output }` out, against a
 * toolset registry populated with the real core toolsets (stub dependencies). Exercises dispatch,
 * help, argument parsing and validation, the requires-dev-server contract, and outcome mapping —
 * everything behind the commander wiring, without spawning processes.
 */

import { Channel } from 'storybook/internal/channels';
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
import {
  createTestToolset,
  type TestRunResult,
} from '../../shared/open-service/toolsets/test/definition.ts';
import {
  TRIGGER_TEST_RUN_REQUEST,
  TRIGGER_TEST_RUN_RESPONSE,
  type TriggerTestRunResponse,
} from '../../shared/open-service/toolsets/test/run.ts';
import type { StorybookInstanceRecord } from '../ai/mcp/types.ts';
import type { ToolsRuntime } from './bootstrap.ts';
import { runToolsCommand, type ToolsRunDeps } from './run.ts';
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

function makeDeps(overrides: Partial<ToolsRunDeps> & { runtime?: Partial<ToolsRuntime> } = {}) {
  const { runtime: runtimeOverrides, ...deps } = overrides;
  const bootstrap =
    deps.bootstrap ??
    vi.fn(async () => ({
      configDir: CONFIG_DIR,
      toolsets: getRegisteredToolsets(),
      getService: () => {
        throw new Error('no services registered in this test');
      },
      ...runtimeOverrides,
    }));
  const discoverInstance =
    deps.discoverInstance ?? vi.fn(async () => ({ record: undefined, records: [] }));
  return { deps: { ...deps, bootstrap, discoverInstance }, bootstrap, discoverInstance };
}

function run(argv: string[], deps: ToolsRunDeps) {
  const [toolset, tool, ...tokens] = argv;
  return runToolsCommand({ toolset, tool, tokens, target: {} }, deps);
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
    const mcpCtx: ToolsetCtx = { consumer: 'mcp', getService: () => ({}) as never };
    const mcpOutcome = await getToolset('docs').methods.list.handler({}, mcpCtx);
    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'success' });
    expect(result.output).toContain('Button');
    expect(result.output).toBe(mcpOutcome.markdown);
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
    const { deps, bootstrap } = makeDeps({
      runtime: {
        getService: () => moduleGraph as never,
        moduleGraphReadiness: { status: 'ready' },
      },
    });

    const result = await run(['stories', 'changed'], deps);

    expect(bootstrap).toHaveBeenCalledWith({}, { hostModuleGraph: true });
    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('# Changed stories');
    expect(result.output).toContain('New: 0, modified: 0, affected: 0');
  });

  it('fails graph tools with the typed unavailable error when the builder has no adapter', async () => {
    const { deps, bootstrap } = makeDeps({
      runtime: {
        moduleGraphReadiness: {
          status: 'unavailable',
          reason: 'builder does not support change detection',
        },
      },
    });

    const result = await run(
      ['stories', 'find-by-component', '--componentPaths', '["/x.tsx"]'],
      deps
    );

    expect(bootstrap).toHaveBeenCalledWith({}, { hostModuleGraph: true });
    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'failure' });
    expect(result.output).toBe('builder does not support change detection');
  });

  it('does not host the module graph for tools that do not need it', async () => {
    const { deps, bootstrap } = makeDeps();

    await run(['docs', 'list'], deps);

    expect(bootstrap).toHaveBeenCalledWith({}, { hostModuleGraph: false });
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

  it('lists running instances of other projects in the no-instance guidance', async () => {
    const { deps } = makeDeps({
      discoverInstance: vi.fn(async () => ({ record: undefined, records: [RECORD] })),
    });

    const result = await run(
      ['stories', 'preview', '--stories', '[{"storyId":"button--primary"}]'],
      deps
    );

    expect(result.output).toContain('http://localhost:6006');
    expect(result.output).toContain('--cwd');
  });

  it('runs stories preview against a discovered instance, regardless of its MCP status', async () => {
    const { deps } = makeDeps({
      discoverInstance: vi.fn(async () => ({ record: RECORD, records: [RECORD] })),
    });

    const result = await run(
      ['stories', 'preview', '--stories', '[{"storyId":"button--primary"}]'],
      deps
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('http://localhost:6006');
  });

  it('reports state-bound tools as not attachable when an instance is running', async () => {
    const { deps } = makeDeps({
      discoverInstance: vi.fn(async () => ({ record: RECORD, records: [RECORD] })),
    });

    const result = await run(['review', 'create', '--input', '{}'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'attach-unavailable' });
    expect(result.output).toContain('http://localhost:6006');
    expect(result.output).toContain('cannot attach to a running Storybook yet');
  });

  it('gives state-bound tools the same start-the-dev-server message when nothing is running', async () => {
    const { deps } = makeDeps();

    const result = await run(['review', 'create', '--input', '{}'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'intercept', reason: 'requires-dev-server' });
    expect(result.output).toContain('requires a running Storybook dev server');
  });
});

describe('local test runs', () => {
  type TestRunRequestPayload = {
    requestId: string;
    storyIds?: string[];
    config?: Record<string, unknown>;
  };

  const COMPLETED_RESULT: TestRunResult = {
    config: { a11y: false, coverage: false },
    componentTestStatuses: [],
    a11yStatuses: [],
    componentTestCount: { success: 1, error: 0 },
    a11yCount: { success: 0, warning: 0, error: 0 },
    a11yReports: {},
    reports: {},
    totalTestCount: 1,
    storyIds: ['button--primary'],
    unhandledErrors: [],
  };

  /**
   * The responder half of the real protocol: addon-vitest answers requests over the same channel
   * object the toolset emits on, which is what its `services` hook wires in production. The real
   * toolset with a scripted responder exercises the whole local path — selector resolution,
   * request/response correlation, outcome mapping — without booting vitest.
   */
  function registerTestToolsetWithResponder(
    respond: (payload: TestRunRequestPayload) => Omit<TriggerTestRunResponse, 'requestId'>
  ) {
    const channel = new Channel({});
    const requests: TestRunRequestPayload[] = [];
    channel.on(TRIGGER_TEST_RUN_REQUEST, (payload: TestRunRequestPayload) => {
      requests.push(payload);
      channel.emit(TRIGGER_TEST_RUN_RESPONSE, {
        requestId: payload.requestId,
        ...respond(payload),
      });
    });
    clearToolsetRegistry();
    registerToolset(
      createTestToolset({
        channel,
        storyIndex: { getIndex: async () => STORY_INDEX },
        a11yEnabled: false,
      })
    );
    return { requests };
  }

  it('runs story tests without a dev server and reports the completed run', async () => {
    const { requests } = registerTestToolsetWithResponder(() => ({
      status: 'completed',
      result: COMPLETED_RESULT,
    }));
    const { deps, discoverInstance } = makeDeps();

    const result = await run(['test', 'run', '--stories', '[{"storyId":"button--primary"}]'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'success' });
    expect(result.output).toContain('# Test run completed');
    expect(result.output).toContain('Component tests: 1 passed, 0 failed');
    // The run went through selector resolution to the responder, not through instance discovery.
    expect(requests).toEqual([expect.objectContaining({ storyIds: ['button--primary'] })]);
    expect(discoverInstance).not.toHaveBeenCalled();
  });

  it('prints the structured run result with --json', async () => {
    registerTestToolsetWithResponder(() => ({ status: 'completed', result: COMPLETED_RESULT }));
    const { deps } = makeDeps();

    const result = await run(['test', 'run', '--json'], deps);

    expect(result.exitCode).toBe(0);
    const data = JSON.parse(result.output);
    expect(data.status).toBe('completed');
    expect(data.result.componentTestCount).toEqual({ success: 1, error: 0 });
  });

  it('exits non-zero when the run errors, printing the report', async () => {
    registerTestToolsetWithResponder(() => ({
      status: 'error',
      error: { message: 'vitest crashed' },
    }));
    const { deps } = makeDeps();

    const result = await run(['test', 'run'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'failure' });
    expect(result.output).toContain('vitest crashed');
  });

  it('exits non-zero when the run is cancelled', async () => {
    registerTestToolsetWithResponder(() => ({ status: 'cancelled' }));
    const { deps } = makeDeps();

    const result = await run(['test', 'run'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.outcome).toEqual({ kind: 'failure' });
    expect(result.output).toContain('cancelled');
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
    registerCoreToolsetsForTest({ testToolset: false });
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
    // Test runs are answered in-process by addon-vitest's responder, so discovery shows them as
    // local rather than requiring a running Storybook.
    expect(result.output).toContain('test run  [local]');
    expect(result.output).toContain('stories find-by-component');
    // Input schemas come from the valibot definitions.
    expect(result.output).toContain('`--componentPaths`');
    // Declared output schemas are part of the dump.
    expect(result.output).toContain('Output:');
  });

  it('renders one toolset’s section with a usage line on a bare toolset name', async () => {
    const { deps } = makeDeps();

    const result = await run(['docs'], deps);

    expect(result.exitCode).toBe(0);
    expect(result.outcome).toEqual({ kind: 'help' });
    expect(result.output).toContain('Usage: npx storybook tools docs <tool> [--key value ...]');
    expect(result.output).toContain('docs show-story  [local]');
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
        telemetryGroup: 'dev',
        methods: {
          probe: {
            title: 'Probe',
            schema: foreignSchema as never,
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
    expect(result.output).not.toContain('get-changed-stories');
  });
});

describe('outcome mapping', () => {
  beforeEach(() => {
    clearToolsetRegistry();
    registerToolset(
      defineToolset({
        id: 'echo',
        description: 'Test toolset for outcome mapping.',
        telemetryGroup: 'dev',
        methods: {
          ok: {
            title: 'ok',
            schema: v.object({}),
            description: 'ok',
            handler: async () => ({ ok: true, data: { a: 1 }, markdown: ['one', 'two'] }),
          },
          bad: {
            title: 'bad',
            schema: v.object({}),
            description: 'bad',
            handler: async () => ({ ok: false, data: { a: 0 }, markdown: 'bad news' }),
          },
          boom: {
            title: 'boom',
            schema: v.object({}),
            description: 'boom',
            handler: async () => {
              throw new Error('kapow');
            },
          },
          guide: {
            title: 'guide',
            schema: v.object({}),
            description: 'guide',
            handler: async () => {
              const error = new Error('Start the dev server, then retry.');
              (error as Error & { agentFacing: boolean }).agentFacing = true;
              throw error;
            },
          },
          input: {
            title: 'input',
            schema: v.object({ a: v.optional(v.number()), b: v.optional(v.number()) }),
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
});

describe('bootstrap failures', () => {
  it('reports a configuration that cannot be loaded', async () => {
    const deps: ToolsRunDeps = {
      bootstrap: async () => {
        throw new Error('No configuration files found');
      },
    };

    const result = await run(['docs', 'list'], deps);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('Could not load the Storybook configuration');
    expect(result.output).toContain('No configuration files found');
  });
});
