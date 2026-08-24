import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/client-logger';
import type { StoryContext } from 'storybook/internal/types';

import { createTestChannel, installTestChannel } from '../../../../channels/test-channel.ts';
import {
  SERVICE_COMMAND_ACK,
  SERVICE_COMMAND_ERROR,
  SERVICE_COMMAND_INVOKE,
  SERVICE_PATCHES,
  type CommandInvokePayload,
  type PatchesPayload,
} from '../../service-channel.ts';
import { serializeError } from '../../service-error-serialization.ts';
import { clearRegistry } from '../../service-registry.ts';
import { registerService } from '../../preview.ts';
import type { CommandCtx } from '../../types.ts';
import { registerStoryDocsPreviewService } from '../story-docs/preview.ts';
import type { StoryDocsPayload } from '../story-docs/types.ts';
import { dynamicSnippetServiceDef, type DynamicSnippetServiceState } from './definition.ts';
import {
  createDynamicSnippetInput,
  type DynamicSnippetInput,
  dynamicSnippetInputKey,
  renderDynamicSnippetSource,
} from './dynamic-snippet.ts';
import { dynamicSnippetBeforeEach, registerDynamicSnippetPreviewService } from './preview.ts';

const storyId = 'button--primary';
const args = { disabled: true, label: 'Live' };
const input = createDynamicSnippetInput(storyId, args);

const makePayload = (kind = 'Button', warning?: string): StoryDocsPayload => ({
  id: 'button',
  name: 'Button',
  path: './Button.stories.tsx',
  import: "import { Button } from './Button';",
  stories: {
    [storyId]: {
      id: storyId,
      name: 'Primary',
      snippet: `<${kind} label="Declared" />`,
      snippetTemplate: { kind },
      ...(warning === undefined ? {} : { warning }),
    },
  },
});

const sourceParameters = () => ({
  originalSource: '<Button label="Original" />',
  renderSnippetTemplate: vi.fn(
    (template: unknown, args: Record<string, unknown>) =>
      `<${(template as { kind: string }).kind} label="${args.label}" />`
  ),
  transform: vi.fn(
    async (source: string, context: { args: Record<string, unknown> }) =>
      `${source}\n// disabled: ${String(context.args.disabled)}`
  ),
});

const stubPreview = (source: ReturnType<typeof sourceParameters>) => {
  const loadStory = vi.fn(async () => ({ id: storyId }));
  const getStoryContext = vi.fn((_story: unknown, options?: { forceInitialArgs?: boolean }) => ({
    unmappedArgs: options?.forceInitialArgs ? { disabled: false, label: 'Declared' } : args,
    parameters: { docs: { source } },
  }));
  vi.stubGlobal('__STORYBOOK_PREVIEW__', { loadStory, getStoryContext });
  return { loadStory, getStoryContext };
};

let channel: ReturnType<typeof createTestChannel>;

beforeEach(() => {
  channel = createTestChannel();
  installTestChannel(channel);
  vi.stubGlobal('CONFIG_TYPE', 'DEVELOPMENT');
  vi.stubGlobal('FEATURES', { experimentalDocgenServer: true });
});

afterEach(() => {
  clearRegistry();
  installTestChannel(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dynamic snippet rendering', () => {
  it('uses query args for template rendering and stable cache identity', () => {
    const source = sourceParameters();
    const context = { parameters: { docs: { source } } };

    const rendered = renderDynamicSnippetSource(input, makePayload(), context, args);

    expect(rendered).toBe('import { Button } from \'./Button\';\n\n<Button label="Live" />');
    expect(source.renderSnippetTemplate).toHaveBeenCalledWith({ kind: 'Button' }, args);
    expect(dynamicSnippetInputKey(input)).toBe(
      dynamicSnippetInputKey(createDynamicSnippetInput(storyId, { label: 'Live', disabled: true }))
    );
    expect(dynamicSnippetInputKey(input)).not.toBe(
      dynamicSnippetInputKey(
        createDynamicSnippetInput(storyId, { label: 'Changed', disabled: true })
      )
    );
  });

  it('creates a transport-safe identity for non-JSON args', () => {
    const unsafeArgs = {
      count: 1n,
      createdAt: new Date('2026-08-20T12:00:00.000Z'),
      missing: undefined,
      pattern: /primary/gi,
    };
    const transportInput = createDynamicSnippetInput(storyId, unsafeArgs);

    expect(() => JSON.stringify(transportInput)).not.toThrow();
    expect(dynamicSnippetInputKey(transportInput)).toBe(
      dynamicSnippetInputKey(createDynamicSnippetInput(storyId, unsafeArgs))
    );
    expect(
      dynamicSnippetInputKey(
        createDynamicSnippetInput(storyId, { callback: () => {}, label: 'Live' })
      )
    ).toBe(dynamicSnippetInputKey(createDynamicSnippetInput(storyId, { label: 'Live' })));
  });

  it('uses the declared snippet when exact preview args are unavailable', () => {
    const source = sourceParameters();
    const transportInput = createDynamicSnippetInput(storyId, { callback: () => {} });

    expect(
      renderDynamicSnippetSource(transportInput, makePayload(), {
        parameters: { docs: { source } },
      })
    ).toBe('import { Button } from \'./Button\';\n\n<Button label="Declared" />');
    expect(source.renderSnippetTemplate).not.toHaveBeenCalled();
  });
});

describe('dynamic snippet preview service', () => {
  it('keeps a preview-authored record while the local StoryDocs mirror is still empty', async () => {
    registerStoryDocsPreviewService();
    const renderDynamicSnippet = vi.fn(
      async (commandInput: DynamicSnippetInput, ctx: CommandCtx<DynamicSnippetServiceState>) => {
        const record = { revision: 'preview-story-docs-revision', source: 'Rendered in preview' };
        ctx.self.setState((state) => {
          const storyRecords = (state.records[commandInput.storyId] ??= {});
          storyRecords[commandInput.slot] = {
            argsKey: commandInput.argsKey,
            record,
          };
        });
        return record;
      }
    );
    const service = registerService(dynamicSnippetServiceDef, {
      commands: { renderDynamicSnippet: { handler: renderDynamicSnippet } },
    });
    let status: string | undefined;

    const unsubscribe = service.queries.dynamicSnippet.subscribe(input, (state) => {
      status = state.status;
    });

    await vi.waitFor(() => expect(status).toBe('success'));
    expect(renderDynamicSnippet).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('reacts to StoryDocs changes and repairs a record removed by a peer snapshot', async () => {
    const source = sourceParameters();
    const preview = stubPreview(source);
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload('Button', 'Initial warning') } },
      version: 1,
      clientId: 'story-docs-peer',
    });

    const unsubscribe = service.queries.dynamicSnippet.subscribe(input, () => {});
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.source).toContain('<Button label="Live" />')
    );
    expect(service.queries.dynamicSnippet.get(input)?.warning).toBe('Initial warning');
    expect(preview.getStoryContext).toHaveBeenCalledTimes(1);

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload('FancyButton', 'Updated warning') } },
      version: 2,
      clientId: 'story-docs-peer',
    });

    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.source).toContain(
        '<FancyButton label="Live" />'
      )
    );
    expect(preview.getStoryContext).toHaveBeenCalledTimes(2);
    expect(service.queries.dynamicSnippet.get(input)?.warning).toBe('Updated warning');

    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/dynamic-snippets',
      state: { records: {} },
      version: 100,
      clientId: 'dynamic-snippets-peer',
    });

    await vi.waitFor(() => expect(preview.getStoryContext).toHaveBeenCalledTimes(3));
    expect(service.queries.dynamicSnippet.get(input)?.source).toContain(
      '<FancyButton label="Live" />'
    );
    unsubscribe();
  });

  it('falls back to original source when StoryDocs loading fails', async () => {
    const source = sourceParameters();
    stubPreview(source);
    channel.on(SERVICE_COMMAND_INVOKE, (request: CommandInvokePayload) => {
      if (request.commandName !== 'extractStoryDocs') {
        return;
      }
      channel.emitExternal(SERVICE_COMMAND_ACK, {
        serviceId: request.serviceId,
        callId: request.callId,
        clientId: 'server',
      });
      channel.emitExternal(SERVICE_COMMAND_ERROR, {
        serviceId: request.serviceId,
        callId: request.callId,
        error: serializeError(new Error('StoryDocs unavailable')),
        clientId: 'server',
      });
    });
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();

    const record = await service.commands.renderDynamicSnippet(input);

    expect(record).toEqual({
      revision: expect.any(String),
      source: '<Button label="Original" />',
    });
    expect(service.queries.dynamicSnippet.get(input)).toEqual(record);
  });

  it('does not carry a StoryDocs warning with the original-source fallback', async () => {
    const source = sourceParameters();
    stubPreview(source);
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    const storyDocs = makePayload();
    storyDocs.stories[storyId] = {
      id: storyId,
      name: 'Primary',
      warning: 'No static snippet',
    };
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: storyDocs } },
      version: 1,
      clientId: 'story-docs-peer',
    });

    const record = await service.commands.renderDynamicSnippet(input);

    expect(record).toEqual({
      revision: expect.any(String),
      source: '<Button label="Original" />',
    });
  });

  it('carries the StoryDocs warning with the generated source', async () => {
    const source = sourceParameters();
    stubPreview(source);
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload('Button', 'Incomplete snippet') } },
      version: 1,
      clientId: 'story-docs-peer',
    });

    const record = await service.commands.renderDynamicSnippet(input);

    expect(record).toMatchObject({
      source: expect.stringContaining('<Button label="Live" />'),
      warning: 'Incomplete snippet',
    });
  });

  it('uses the active render context for source transformations', async () => {
    const source = sourceParameters();
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const publish = vi.fn();
    channel.on(SERVICE_PATCHES, publish);
    const context = {
      id: storyId,
      args: { disabled: 'mapped', label: 'Live' },
      unmappedArgs: args,
      initialArgs: { disabled: false, label: 'Initial' },
      globals: { theme: 'dark' },
      loaded: { fixture: true },
      viewMode: 'story',
      parameters: { __isArgsStory: true, docs: { source } },
    } as unknown as StoryContext;

    const cleanup = dynamicSnippetBeforeEach(context);

    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain(
        '// disabled: mapped'
      )
    );
    expect(source.renderSnippetTemplate).toHaveBeenCalledWith({ kind: 'Button' }, args);
    expect(source.transform).toHaveBeenCalledWith(expect.any(String), context);
    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({ serviceId: 'core/dynamic-snippets' })
    );
    await cleanup?.();
  });

  it('refreshes the same args when globals change', async () => {
    const transform = vi.fn(
      (source: string, context: StoryContext) => `${source}\n// theme: ${context.globals.theme}`
    );
    const source = { ...sourceParameters(), transform };
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const firstContext = {
      id: storyId,
      args,
      unmappedArgs: args,
      initialArgs: { disabled: false, label: 'Initial' },
      globals: { theme: 'dark' },
      viewMode: 'story',
      parameters: { __isArgsStory: true, docs: { source } },
    } as unknown as StoryContext;
    const secondContext = {
      ...firstContext,
      globals: { theme: 'light' },
    } as StoryContext;

    const firstCleanup = dynamicSnippetBeforeEach(firstContext);
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain(
        '// theme: dark'
      )
    );

    const secondCleanup = dynamicSnippetBeforeEach(secondContext);
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain(
        '// theme: light'
      )
    );

    await firstCleanup?.();
    await service.commands.renderDynamicSnippet(input);
    expect(transform).toHaveBeenLastCalledWith(expect.any(String), secondContext);
    expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain(
      '// theme: light'
    );
    await secondCleanup?.();
  });

  it('leaves docs-view transforms to the Source block', async () => {
    const source = sourceParameters();
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const context = {
      id: storyId,
      args,
      unmappedArgs: args,
      initialArgs: { disabled: false, label: 'Initial' },
      viewMode: 'docs',
      parameters: { __isArgsStory: true, docs: { source } },
    } as unknown as StoryContext;

    const cleanup = dynamicSnippetBeforeEach(context);

    await vi.waitFor(() => expect(service.queries.dynamicSnippet.get(input)?.source).toBeDefined());
    expect(source.transform).not.toHaveBeenCalled();
    expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toBeUndefined();
    await cleanup?.();
  });

  it('retains only current and initial records for each story', async () => {
    const source = sourceParameters();
    const initialArgs = { disabled: false, label: 'Initial' };
    const firstArgs = { disabled: true, label: 'First' };
    const latestArgs = { disabled: true, label: 'Latest' };
    const firstInput = createDynamicSnippetInput(storyId, firstArgs);
    const latestInput = createDynamicSnippetInput(storyId, latestArgs);
    const initialInput = createDynamicSnippetInput(storyId, initialArgs, 'initial');
    const resetInput = createDynamicSnippetInput(storyId, initialArgs);
    let latestRecords: DynamicSnippetServiceState['records'] | undefined;
    channel.on(SERVICE_PATCHES, (payload: PatchesPayload) => {
      if (payload.serviceId === 'core/dynamic-snippets') {
        latestRecords = (payload.state as DynamicSnippetServiceState).records;
      }
    });
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const contextFor = (contextArgs: typeof initialArgs, viewMode: 'docs' | 'story') =>
      ({
        id: storyId,
        args: contextArgs,
        unmappedArgs: contextArgs,
        initialArgs,
        globals: {},
        viewMode,
        parameters: { __isArgsStory: true, docs: { source } },
      }) as unknown as StoryContext;

    const firstCleanup = dynamicSnippetBeforeEach(contextFor(firstArgs, 'docs'));
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(firstInput)?.source).toContain('label="First"')
    );
    await firstCleanup?.();

    const initialCleanup = dynamicSnippetBeforeEach(contextFor(initialArgs, 'docs'));
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(initialInput)?.source).toContain('label="Initial"')
    );
    await initialCleanup?.();

    const latestCleanup = dynamicSnippetBeforeEach(contextFor(latestArgs, 'docs'));
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(latestInput)?.source).toContain('label="Latest"')
    );
    await latestCleanup?.();

    expect(service.queries.dynamicSnippet.get(firstInput)).toBeUndefined();
    expect(service.queries.dynamicSnippet.get(latestInput)?.source).toContain('label="Latest"');
    expect(service.queries.dynamicSnippet.get(initialInput)?.source).toContain('label="Initial"');

    const resetCleanup = dynamicSnippetBeforeEach(contextFor(initialArgs, 'story'));
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(resetInput)?.source).toContain('label="Initial"')
    );
    await resetCleanup?.();

    expect(service.queries.dynamicSnippet.get(resetInput)?.source).toContain('label="Initial"');
    expect(service.queries.dynamicSnippet.get(initialInput)?.source).toContain('label="Initial"');
    expect(Object.keys(latestRecords?.[storyId] ?? {})).toHaveLength(2);
  });

  it('keeps the raw source when the preview transform fails', async () => {
    vi.spyOn(once, 'warn').mockImplementation(() => {});
    const source = sourceParameters();
    source.transform.mockRejectedValue(new Error('formatting failed'));
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const context = {
      id: storyId,
      args,
      unmappedArgs: args,
      initialArgs: { disabled: false, label: 'Initial' },
      viewMode: 'story',
      parameters: { __isArgsStory: true, docs: { source } },
    } as unknown as StoryContext;

    const cleanup = dynamicSnippetBeforeEach(context);

    await vi.waitFor(() => expect(service.queries.dynamicSnippet.get(input)?.source).toBeDefined());
    expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toBeUndefined();
    expect(once.warn).toHaveBeenCalledWith(expect.stringContaining('formatting failed'));
    await cleanup?.();
  });

  it('does not publish a transform that finishes after cleanup', async () => {
    let releaseTransform = () => {};
    const source = sourceParameters();
    source.transform.mockImplementation(
      (renderedSource: string) =>
        new Promise<string>((resolve) => {
          releaseTransform = () => resolve(`${renderedSource}\n// late`);
        })
    );
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const context = {
      id: storyId,
      args,
      unmappedArgs: args,
      initialArgs: { disabled: false, label: 'Initial' },
      viewMode: 'story',
      parameters: { __isArgsStory: true, docs: { source } },
    } as unknown as StoryContext;

    const cleanup = dynamicSnippetBeforeEach(context);
    await vi.waitFor(() => expect(source.transform).toHaveBeenCalledOnce());

    expect(cleanup?.()).toBeUndefined();
    releaseTransform();
    await Promise.resolve();
    await Promise.resolve();

    expect(service.queries.dynamicSnippet.get(input)).toBeUndefined();
  });

  it('does not await a superseded transform during cleanup', async () => {
    const staleArgs = { disabled: true, label: 'Stale' };
    const staleSource = sourceParameters();
    staleSource.transform.mockImplementation(() => new Promise<string>(() => {}));
    const latestSource = sourceParameters();
    latestSource.transform.mockImplementation(async (renderedSource: string) =>
      renderedSource.concat('\n// latest')
    );
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const contextFor = (source: ReturnType<typeof sourceParameters>, contextArgs: typeof args) =>
      ({
        id: storyId,
        args: contextArgs,
        unmappedArgs: contextArgs,
        initialArgs: { disabled: false, label: 'Initial' },
        viewMode: 'story',
        parameters: { __isArgsStory: true, docs: { source } },
      }) as unknown as StoryContext;

    const staleCleanup = dynamicSnippetBeforeEach(contextFor(staleSource, staleArgs));
    await vi.waitFor(() => expect(staleSource.transform).toHaveBeenCalledOnce());

    const latestCleanup = dynamicSnippetBeforeEach(contextFor(latestSource, args));
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain('// latest')
    );

    expect(staleCleanup?.()).toBeUndefined();
    expect(latestCleanup?.()).toBeUndefined();
  });

  it('does not let a slower previous transform replace the latest result', async () => {
    let releaseFirstTransform = () => {};
    const firstArgs = { disabled: true, label: 'Stale' };
    const firstInput = createDynamicSnippetInput(storyId, firstArgs);
    const firstSource = sourceParameters();
    firstSource.transform.mockImplementation(
      (source: string) =>
        new Promise<string>((resolve) => {
          releaseFirstTransform = () => resolve(`${source}\n// stale`);
        })
    );
    const latestSource = sourceParameters();
    latestSource.transform.mockImplementation(async (source: string) => `${source}\n// latest`);
    registerStoryDocsPreviewService();
    const service = registerDynamicSnippetPreviewService();
    channel.emitExternal(SERVICE_PATCHES, {
      serviceId: 'core/story-docs',
      state: { components: { button: makePayload() } },
      version: 1,
      clientId: 'story-docs-peer',
    });
    const contextFor = (source: ReturnType<typeof sourceParameters>, contextArgs: typeof args) =>
      ({
        id: storyId,
        args: contextArgs,
        unmappedArgs: contextArgs,
        initialArgs: { disabled: false, label: 'Initial' },
        globals: {},
        viewMode: 'story',
        parameters: { __isArgsStory: true, docs: { source } },
      }) as unknown as StoryContext;

    const firstCleanup = dynamicSnippetBeforeEach(contextFor(firstSource, firstArgs));
    await vi.waitFor(() => expect(firstSource.transform).toHaveBeenCalledOnce());

    const latestCleanup = dynamicSnippetBeforeEach(contextFor(latestSource, args));
    await vi.waitFor(() =>
      expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain('// latest')
    );

    releaseFirstTransform();
    await firstCleanup?.();
    expect(service.queries.dynamicSnippet.get(firstInput)).toBeUndefined();
    expect(service.queries.dynamicSnippet.get(input)?.transformedSource).toContain('// latest');
    await latestCleanup?.();
  });
});
