import { describe, expect, it } from 'vitest';

import { Channel } from 'storybook/internal/channels';
import {
  FORCE_REMOUNT,
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_RENDER_PHASE_CHANGED,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from 'storybook/internal/core-events';

import type { Call, RenderPhase } from '../../instrumenter/types.ts';
import { INTERNAL_RENDER_CALL_ID } from '../constants.ts';
import { INITIAL_PANEL_STATE, type PanelState, panelStore } from './panelStore.ts';
import {
  type RenderTracker,
  getCalls,
  getRenderPhaseState,
  listenForRenderLifecycle,
  recordCall,
  resetRenderLifecycle,
  trackRenderPhase,
} from './renderLifecycle.ts';

describe('trackRenderPhase', () => {
  const replay = (
    events: { storyId: string; newPhase: RenderPhase; renderId: number }[],
    currentStoryId: string
  ) => {
    let tracker: RenderTracker = {};
    return events.flatMap((event) => {
      const result = trackRenderPhase(tracker, event, currentStoryId);
      tracker = result.tracker;
      const again = result.isRerender ? ' again' : '';
      return result.isCurrentRender ? [`${event.storyId}:${event.newPhase}${again}`] : [];
    });
  };

  it('ignores phases of a torn down render of the previous story', () => {
    const handled = replay(
      [
        { storyId: 'page--logged-in', newPhase: 'rendering', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'playing', renderId: 2 },
        { storyId: 'page--logged-out', newPhase: 'aborted', renderId: 1 },
        { storyId: 'page--logged-in', newPhase: 'completed', renderId: 2 },
      ],
      'page--logged-in'
    );

    expect(handled).toEqual([
      'page--logged-in:rendering',
      'page--logged-in:playing',
      'page--logged-in:completed',
    ]);
  });

  it('ignores phases of an older concurrent render of the same story', () => {
    const handled = replay(
      [
        { storyId: 'page--logged-in', newPhase: 'rendering', renderId: 1 },
        { storyId: 'page--logged-in', newPhase: 'rendering', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'aborted', renderId: 1 },
        { storyId: 'page--logged-in', newPhase: 'completed', renderId: 2 },
      ],
      'page--logged-in'
    );

    expect(handled).toEqual([
      'page--logged-in:rendering',
      'page--logged-in:rendering',
      'page--logged-in:completed',
    ]);
  });

  it('reports another rendering phase of the same render as rendering it again', () => {
    const handled = replay(
      [
        { storyId: 'page--logged-in', newPhase: 'preparing', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'rendering', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'completed', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'loading', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'rendering', renderId: 2 },
        { storyId: 'page--logged-in', newPhase: 'rendering', renderId: 3 },
      ],
      'page--logged-in'
    );

    expect(handled).toEqual([
      'page--logged-in:preparing',
      'page--logged-in:rendering',
      'page--logged-in:completed',
      'page--logged-in:rendering again',
      'page--logged-in:rendering',
    ]);
  });
});

describe('getRenderPhaseState', () => {
  const storyId = 'story--id';
  const error = { name: 'Error', message: 'argTypes is gone', stack: 'stack' } as Error;
  const renderCycle = (renderId: number, phases: RenderPhase[]) =>
    phases.map((newPhase) => ({ storyId, newPhase, renderId }));
  // The phases StoryRender reports when the play function throws, then when a re-render follows.
  const failedPlay = [
    ...renderCycle(1, ['preparing', 'loading', 'rendering', 'playing', 'errored']),
    { caughtException: error },
    ...renderCycle(1, ['completing', 'completed', 'afterEach', 'finished']),
  ];
  const rerender = renderCycle(1, ['loading', 'rendering', 'completing', 'completed']);

  const replay = (
    events: (
      | { storyId: string; newPhase: RenderPhase; renderId: number }
      | { caughtException: Error }
    )[]
  ) => {
    let tracker: RenderTracker = {};
    return events.reduce<PanelState>((state, event) => {
      if ('caughtException' in event) {
        return { ...state, caughtException: event.caughtException, hasException: true };
      }
      const result = trackRenderPhase(tracker, event, storyId);
      tracker = result.tracker;
      return result.isCurrentRender
        ? getRenderPhaseState(state, event.newPhase, result.isRerender)
        : state;
    }, INITIAL_PANEL_STATE);
  };

  it('reports the exception of a failed play', () => {
    expect(replay(failedPlay)).toMatchObject({ status: 'errored', caughtException: error });
  });

  it('keeps the failure of the last play through a re-render, which does not play again', () => {
    expect(replay([...failedPlay, ...rerender])).toMatchObject({
      status: 'errored',
      caughtException: error,
      hasException: true,
    });
  });

  it('drops the failure of the last play once a remount plays again', () => {
    const remount = renderCycle(1, ['loading', 'rendering', 'playing', 'played', 'completed']);

    expect(replay([...failedPlay, ...remount])).toMatchObject({
      status: 'completed',
      caughtException: undefined,
      hasException: false,
    });
  });

  it('drops the failure of the last play for a new render of the story', () => {
    const newRender = renderCycle(2, ['preparing', 'loading', 'rendering', 'completed']);

    expect(replay([...failedPlay, ...newRender])).toMatchObject({
      status: 'completed',
      caughtException: undefined,
    });
  });
});

describe('listenForRenderLifecycle', () => {
  const error = { name: 'Error', message: 'argTypes is gone' } as Error;
  const listen = (storyId: string, refId?: string) => {
    resetRenderLifecycle();
    panelStore.setState(INITIAL_PANEL_STATE);
    const channel = new Channel({});
    const selection = { storyId, refId };
    listenForRenderLifecycle({
      on: (type, handler) => {
        channel.on(type, handler);
        return () => channel.off(type, handler);
      },
      getUrlState: () => ({
        storyId: selection.storyId,
        path: `/story/${selection.refId ? `${selection.refId}_` : ''}${selection.storyId}`,
      }),
    });
    const emit = (type: string, payload: unknown, sender = selection.refId) => {
      const event = { type, args: [payload], from: sender ?? 'local', refId: sender };
      channel.receive(event);
    };
    const phases = (
      newPhases: RenderPhase[],
      render: { storyId: string; renderId?: number } = { storyId, renderId: 1 },
      sender = selection.refId
    ) =>
      newPhases.forEach((newPhase) =>
        emit(STORY_RENDER_PHASE_CHANGED, { ...render, newPhase }, sender)
      );
    return { emit, phases, selection };
  };

  it('keeps a failure recorded without a mounted panel through the next re-render', () => {
    const { emit, phases } = listen('closed--story');

    phases(['preparing', 'loading', 'rendering', 'playing', 'errored']);
    emit(PLAY_FUNCTION_THREW_EXCEPTION, error);
    phases(['completing', 'completed', 'loading', 'rendering', 'completing', 'completed']);

    expect(panelStore.getState()).toMatchObject({ status: 'errored', caughtException: error });
  });

  it("ignores play errors that arrive outside the current render's errored phase", () => {
    const { emit, phases } = listen('shown--story');

    phases(['preparing', 'loading', 'rendering', 'playing', 'played', 'completing', 'completed']);
    phases(['errored'], { storyId: 'previous--story', renderId: 1 });
    emit(PLAY_FUNCTION_THREW_EXCEPTION, error);
    emit(UNHANDLED_ERRORS_WHILE_PLAYING, [error]);
    phases(['loading', 'rendering', 'completing', 'completed']);

    expect(panelStore.getState()).toMatchObject({
      status: 'completed',
      caughtException: undefined,
      unhandledErrors: undefined,
    });
  });

  it('ignores a late failure after switching refs with the panel closed', () => {
    const storyId = 'button--primary';
    const { emit, phases, selection } = listen(storyId, 'first');
    const firstRender = { storyId, renderId: 2 };
    phases(['rendering', 'playing'], firstRender);

    selection.refId = 'second';
    phases(['rendering', 'playing', 'played', 'completed']);
    phases(['errored'], firstRender, 'first');
    emit(PLAY_FUNCTION_THREW_EXCEPTION, error, 'first');
    emit(UNHANDLED_ERRORS_WHILE_PLAYING, [error], 'first');
    phases(['loading', 'rendering', 'completed']);

    expect(panelStore.getState()).toMatchObject({
      status: 'completed',
      caughtException: undefined,
      unhandledErrors: undefined,
    });
  });

  it('keeps the error details from the active preview when both refs fail', () => {
    const { emit, phases, selection } = listen('button--secondary', 'first');
    phases(['rendering', 'playing']);
    selection.refId = 'second';
    phases(['rendering', 'playing', 'errored']);
    emit(PLAY_FUNCTION_THREW_EXCEPTION, error);
    emit(UNHANDLED_ERRORS_WHILE_PLAYING, [error]);
    const hiddenError = new Error('error in hidden preview');
    phases(['errored'], { storyId: selection.storyId, renderId: 1 }, 'first');
    emit(PLAY_FUNCTION_THREW_EXCEPTION, hiddenError, 'first');
    emit(UNHANDLED_ERRORS_WHILE_PLAYING, [hiddenError], 'first');

    expect(panelStore.getState()).toMatchObject({
      status: 'errored',
      caughtException: error,
      unhandledErrors: [error],
    });
  });

  it('keeps applying the visible ref after a hidden ref reports a newer render', () => {
    const storyId = 'button--primary';
    const { phases, selection } = listen(storyId, 'first');
    phases(['rendering', 'playing'], { storyId, renderId: 2 });

    selection.refId = 'second';
    phases(['rendering', 'playing']);
    phases(['errored'], { storyId, renderId: 2 }, 'first');
    phases(['played', 'completed']);

    expect(panelStore.getState()).toMatchObject({ status: 'completed' });
  });

  it('keeps a legacy preview failure through a rerender and clears it on a successful play', () => {
    const legacyRender = { storyId: 'legacy--story' };
    const { emit, phases } = listen(legacyRender.storyId, 'legacy');
    phases(['preparing', 'loading', 'rendering', 'playing', 'errored'], legacyRender);
    emit(PLAY_FUNCTION_THREW_EXCEPTION, error);
    emit(UNHANDLED_ERRORS_WHILE_PLAYING, [error]);

    expect(panelStore.getState()).toMatchObject({
      status: 'errored',
      caughtException: error,
      unhandledErrors: [error],
      hasException: true,
    });
    phases(['completing', 'completed', 'loading', 'rendering', 'completed'], legacyRender);
    expect(panelStore.getState()).toMatchObject({
      status: 'errored',
      caughtException: error,
      unhandledErrors: [error],
    });
    phases(['loading', 'rendering', 'playing', 'played', 'completed'], legacyRender);
    expect(panelStore.getState()).toMatchObject({
      status: 'completed',
      caughtException: undefined,
      unhandledErrors: undefined,
    });
  });

  it('stores play errors without a mounted panel and drops them when the story remounts', () => {
    const { emit, phases } = listen('story--id');

    phases(['preparing', 'loading', 'rendering', 'playing', 'errored']);
    emit(PLAY_FUNCTION_THREW_EXCEPTION, error);
    expect(panelStore.getState()).toMatchObject({ caughtException: error, hasException: true });

    emit(FORCE_REMOUNT, { storyId: 'other--story' });
    expect(panelStore.getState().caughtException).toBe(error);

    emit(FORCE_REMOUNT, { storyId: 'story--id' });
    expect(panelStore.getState()).toMatchObject({
      caughtException: undefined,
      hasException: false,
    });
  });

  it("drops the previous story's calls when a render starts, except retained ones", () => {
    const { phases } = listen('next--story');
    const previousCall = (id: string, retain: boolean): Call => ({
      id,
      storyId: 'previous--story',
      cursor: 0,
      ancestors: [],
      path: [],
      method: 'fn',
      args: [],
      interceptable: false,
      retain,
    });
    recordCall(previousCall('previous--story [0] action', true));
    recordCall(previousCall('previous--story [1] click', false));

    phases(['preparing', 'loading', 'rendering']);

    expect(new Set(getCalls().keys())).toEqual(
      new Set([INTERNAL_RENDER_CALL_ID, 'previous--story [0] action'])
    );
  });
});
