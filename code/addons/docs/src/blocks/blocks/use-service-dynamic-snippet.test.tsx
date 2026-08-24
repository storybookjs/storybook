// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Args, PreparedStory } from 'storybook/internal/types';
import {
  createDynamicSnippetInput,
  type DynamicSnippetInput,
  type DynamicSnippetRecord,
  type Query,
  type QueryState,
} from 'storybook/open-service';
import { getService } from 'storybook/preview-api';

import { useSourcePropsWithDynamicSnippet } from './Source.tsx';
import { useDynamicSnippet } from './use-service-dynamic-snippet.ts';

vi.mock('storybook/preview-api', { spy: true });

const storyId = 'button--primary';
const labelsByArgsKey = new Map(
  ['First', 'Second', 'Initial'].map((label) => [
    createDynamicSnippetInput(storyId, { label }).argsKey,
    label,
  ])
);

const successState = <T,>(data: T): QueryState<T> => ({
  data,
  error: undefined,
  status: 'success',
  loadStatus: 'idle',
  isPending: false,
  isSuccess: true,
  isError: false,
  isLoading: false,
  isInitialLoading: false,
  isRefreshing: false,
});

describe('useDynamicSnippet', () => {
  const get = vi.fn(({ argsKey }: DynamicSnippetInput): DynamicSnippetRecord => {
    const label = labelsByArgsKey.get(argsKey);
    return {
      revision: String(label),
      source: `raw ${label}`,
      transformedSource: `service-transformed ${label}`,
      warning: `warning ${label}`,
    };
  });
  let emitRecord: ((record: DynamicSnippetRecord | undefined) => void) | undefined;
  const subscribe = vi.fn(
    (
      _input: DynamicSnippetInput,
      selector: (record: DynamicSnippetRecord | undefined) => DynamicSnippetRecord | undefined,
      callback: (state: QueryState<DynamicSnippetRecord | undefined>) => void
    ) => {
      emitRecord = (record) => callback(successState(selector(record)));
      return () => {
        emitRecord = undefined;
      };
    }
  );
  const dynamicSnippet = {
    get,
    loaded: vi.fn(),
    subscribe,
  } as unknown as Query<DynamicSnippetInput, DynamicSnippetRecord | undefined>;

  beforeEach(() => {
    vi.mocked(getService).mockReturnValue({ queries: { dynamicSnippet } } as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
    emitRecord = undefined;
  });

  it('returns the dynamic snippet record and follows query updates and args', async () => {
    const { result, rerender } = renderHook(
      ({ args }: { args: Args }) => useDynamicSnippet(storyId, args),
      { initialProps: { args: { label: 'First' } } }
    );

    expect(result.current.data).toMatchObject({ source: 'raw First', warning: 'warning First' });
    expect(getService).toHaveBeenCalledWith('core/dynamic-snippets', { internal: true });
    expect(get.mock.calls[0]![0]).toEqual(createDynamicSnippetInput(storyId, { label: 'First' }));

    await waitFor(() => expect(emitRecord).toBeDefined());
    act(() => {
      emitRecord?.({
        revision: 'updated',
        source: 'raw updated',
        transformedSource: 'service-transformed updated',
      });
    });
    expect(result.current.data).toMatchObject({ source: 'raw updated' });

    rerender({ args: { label: 'Second' } });

    expect(result.current.data).toMatchObject({ source: 'raw Second', warning: 'warning Second' });
    expect(get).toHaveBeenLastCalledWith(createDynamicSnippetInput(storyId, { label: 'Second' }));
  });

  it('keeps forced-initial source separate from current source', () => {
    renderHook(() => useDynamicSnippet(storyId, { label: 'Initial' }, 'initial'));

    expect(get).toHaveBeenCalledWith(
      createDynamicSnippetInput(storyId, { label: 'Initial' }, 'initial')
    );
  });

  it('feeds the shared Source and Canvas props path', () => {
    const transform = vi.fn(
      (source: string, context: { args: Args }) => `${source} for ${String(context.args.label)}`
    );
    const story = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as PreparedStory;
    const storyContext = {
      id: storyId,
      unmappedArgs: { label: 'First' },
      initialArgs: { label: 'Initial' },
      parameters: { __isArgsStory: true, docs: { source: { transform } } },
    } as Parameters<typeof useSourcePropsWithDynamicSnippet>[2];

    const { result } = renderHook(() =>
      useSourcePropsWithDynamicSnippet({ __forceInitialArgs: true }, story, storyContext, {
        sources: {},
      })
    );

    expect(result.current.code).toBe('raw Initial for Initial');
    expect(transform).toHaveBeenCalledWith(
      'raw Initial',
      expect.objectContaining({ args: { label: 'Initial' } })
    );
    expect(result.current.warning).toBeUndefined();
  });

  it('feeds the snippet warning through the shared Source and Canvas props path', () => {
    const story = {
      id: storyId,
      parameters: { __isArgsStory: true },
    } as unknown as PreparedStory;
    const storyContext = {
      id: storyId,
      unmappedArgs: { label: 'First' },
      initialArgs: { label: 'Initial' },
      parameters: { __isArgsStory: true },
    } as Parameters<typeof useSourcePropsWithDynamicSnippet>[2];

    const { result } = renderHook(() =>
      useSourcePropsWithDynamicSnippet({ __forceInitialArgs: true }, story, storyContext, {
        sources: {},
      })
    );

    expect(result.current).toMatchObject({
      code: 'raw Initial',
      warning: 'warning Initial',
    });
  });
});
