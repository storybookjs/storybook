// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { type Call, CallStates, type LogItem } from '../../instrumenter/types';
import { INTERNAL_RENDER_CALL_ID } from '../constants';
import { type PanelState, getInteractions, getPanelState } from './Panel';

describe('Panel', () => {
  const log: LogItem[] = [
    {
      callId: INTERNAL_RENDER_CALL_ID,
      status: CallStates.DONE,
      ancestors: [],
    },
    {
      callId: 'story--id [4] findByText',
      status: CallStates.DONE,
      ancestors: [],
    },
    {
      callId: 'story--id [5] click',
      status: CallStates.DONE,
      ancestors: [],
    },
    {
      callId: 'story--id [6] waitFor',
      status: CallStates.DONE,
      ancestors: [],
    },
    {
      callId: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
      status: CallStates.DONE,
      ancestors: ['story--id [6] waitFor'],
    },
  ];
  const calls = new Map<Call['id'], Call>(
    [
      {
        id: INTERNAL_RENDER_CALL_ID,
        storyId: 'story--id',
        ancestors: [],
        cursor: 0,
        path: [],
        method: 'render',
        args: [],
        interceptable: true,
        retain: false,
      },
      {
        id: 'story--id [0] action',
        storyId: 'story--id',
        ancestors: [],
        cursor: 0,
        path: [],
        method: 'action',
        args: [{ __function__: { name: 'onSubmit' } }],
        interceptable: false,
        retain: true,
      },
      {
        id: 'story--id [1] action',
        storyId: 'story--id',
        ancestors: [],
        cursor: 1,
        path: [],
        method: 'action',
        args: [{ __function__: { name: 'onTransactionStart' } }],
        interceptable: false,
        retain: true,
      },
      {
        id: 'story--id [2] action',
        storyId: 'story--id',
        ancestors: [],
        cursor: 2,
        path: [],
        method: 'action',
        args: [{ __function__: { name: 'onTransactionEnd' } }],
        interceptable: false,
        retain: true,
      },
      {
        id: 'story--id [3] within',
        storyId: 'story--id',
        ancestors: [],
        cursor: 3,
        path: [],
        method: 'within',
        args: [{ __element__: { localName: 'div', id: 'root', innerText: 'Click' } }],
        interceptable: false,
        retain: false,
      },
      {
        id: 'story--id [4] findByText',
        storyId: 'story--id',
        ancestors: [],
        cursor: 4,
        path: [{ __callId__: 'story--id [3] within' }],
        method: 'findByText',
        args: ['Click'],
        interceptable: true,
        retain: false,
      },
      {
        id: 'story--id [5] click',
        storyId: 'story--id',
        ancestors: [],
        cursor: 5,
        path: ['userEvent'],
        method: 'click',
        args: [{ __element__: { localName: 'button', innerText: 'Click' } }],
        interceptable: true,
        retain: false,
      },
      {
        id: 'story--id [6] waitFor [0] expect',
        storyId: 'story--id',
        ancestors: ['story--id [6] waitFor'],
        cursor: 0,
        path: [],
        method: 'expect',
        args: [{ __callId__: 'story--id [0] action', retain: true }],
        interceptable: true,
        retain: false,
      },
      {
        id: 'story--id [6] waitFor [1] stringMatching',
        storyId: 'story--id',
        ancestors: ['story--id [6] waitFor'],
        cursor: 1,
        path: ['expect'],
        method: 'stringMatching',
        args: [{ __regexp__: { flags: 'gi', source: '([A-Z])\\w+' } }],
        interceptable: false,
        retain: false,
      },
      {
        id: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
        storyId: 'story--id',
        ancestors: ['story--id [6] waitFor'],
        cursor: 2,
        path: [{ __callId__: 'story--id [6] waitFor [0] expect' }],
        method: 'toHaveBeenCalledWith',
        args: [{ __callId__: 'story--id [6] waitFor [1] stringMatching', retain: false }],
        interceptable: true,
        retain: false,
      },
      {
        id: 'story--id [6] waitFor',
        storyId: 'story--id',
        ancestors: [],
        cursor: 6,
        path: [],
        method: 'waitFor',
        args: [{ __function__: { name: '' } }],
        interceptable: true,
        retain: false,
      },
    ].map((v) => [v.id, v])
  );
  const collapsed = new Set<Call['id']>();
  const setCollapsed = () => {};

  const baseState: PanelState = {
    status: 'completed',
    controlStates: {
      detached: false,
      start: true,
      back: true,
      goto: true,
      next: true,
      end: true,
    },
    interactions: [],
    interactionsCount: 0,
    hasException: false,
  };

  describe('getInteractions', () => {
    it('returns list of interactions', () => {
      expect(getInteractions({ log, calls, collapsed, setCollapsed })).toEqual([
        {
          ...calls.get(INTERNAL_RENDER_CALL_ID),
          status: CallStates.DONE,
          childCallIds: undefined,
          isHidden: false,
          isCollapsed: false,
          toggleCollapsed: expect.any(Function),
        },
        {
          ...calls.get('story--id [4] findByText'),
          status: CallStates.DONE,
          childCallIds: undefined,
          isHidden: false,
          isCollapsed: false,
          toggleCollapsed: expect.any(Function),
        },
        {
          ...calls.get('story--id [5] click'),
          status: CallStates.DONE,
          childCallIds: undefined,
          isHidden: false,
          isCollapsed: false,
          toggleCollapsed: expect.any(Function),
        },
        {
          ...calls.get('story--id [6] waitFor'),
          status: CallStates.DONE,
          childCallIds: ['story--id [6] waitFor [2] toHaveBeenCalledWith'],
          isHidden: false,
          isCollapsed: false,
          toggleCollapsed: expect.any(Function),
        },
        {
          ...calls.get('story--id [6] waitFor [2] toHaveBeenCalledWith'),
          status: CallStates.DONE,
          childCallIds: undefined,
          isHidden: false,
          isCollapsed: false,
          toggleCollapsed: expect.any(Function),
        },
      ]);
    });

    it('hides calls for which the parent is collapsed', () => {
      const withCollapsed = new Set<Call['id']>(['story--id [6] waitFor']);

      expect(getInteractions({ log, calls, collapsed: withCollapsed, setCollapsed })).toEqual([
        expect.objectContaining({
          ...calls.get(INTERNAL_RENDER_CALL_ID),
          childCallIds: undefined,
          isCollapsed: false,
          isHidden: false,
        }),
        expect.objectContaining({
          ...calls.get('story--id [4] findByText'),
          childCallIds: undefined,
          isCollapsed: false,
          isHidden: false,
        }),
        expect.objectContaining({
          ...calls.get('story--id [5] click'),
          childCallIds: undefined,
          isCollapsed: false,
          isHidden: false,
        }),
        expect.objectContaining({
          ...calls.get('story--id [6] waitFor'),
          childCallIds: ['story--id [6] waitFor [2] toHaveBeenCalledWith'],
          isCollapsed: true,
          isHidden: false,
        }),
        expect.objectContaining({
          ...calls.get('story--id [6] waitFor [2] toHaveBeenCalledWith'),
          childCallIds: undefined,
          isCollapsed: false,
          isHidden: true,
        }),
      ]);
    });

    it('uses status from log', () => {
      const withError = log.slice(0, 4).concat({ ...log[4], status: CallStates.ERROR });

      expect(getInteractions({ log: withError, calls, collapsed, setCollapsed })).toEqual([
        expect.objectContaining({
          id: INTERNAL_RENDER_CALL_ID,
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [4] findByText',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [5] click',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [6] waitFor',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
          status: CallStates.ERROR,
        }),
      ]);
    });

    it('keeps status active for errored child calls while parent is active', () => {
      const withActiveError = log.slice(0, 3).concat([
        { ...log[3], status: CallStates.ACTIVE },
        { ...log[4], status: CallStates.ERROR },
      ]);

      expect(getInteractions({ log: withActiveError, calls, collapsed, setCollapsed })).toEqual([
        expect.objectContaining({
          id: INTERNAL_RENDER_CALL_ID,
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [4] findByText',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [5] click',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [6] waitFor',
          status: CallStates.ACTIVE,
        }),
        expect.objectContaining({
          id: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
          status: CallStates.ACTIVE, // not ERROR
        }),
      ]);
    });

    it('does not override child status other than error for active parent', () => {
      const withActiveWaiting = log.slice(0, 3).concat([
        { ...log[3], status: CallStates.ACTIVE },
        { ...log[4], status: CallStates.WAITING },
      ]);

      expect(getInteractions({ log: withActiveWaiting, calls, collapsed, setCollapsed })).toEqual([
        expect.objectContaining({
          id: INTERNAL_RENDER_CALL_ID,
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [4] findByText',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [5] click',
          status: CallStates.DONE,
        }),
        expect.objectContaining({
          id: 'story--id [6] waitFor',
          status: CallStates.ACTIVE,
        }),
        expect.objectContaining({
          id: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
          status: CallStates.WAITING,
        }),
      ]);
    });
  });

  describe('getPanelState', () => {
    it('always includes internal render call interactions', () => {
      const renderingState = { ...baseState, status: 'rendering' as const };
      const completedState = { ...baseState, status: 'completed' as const };

      const renderingResult = getPanelState(renderingState, {
        log,
        calls,
        collapsed,
        setCollapsed,
      });
      const completedResult = getPanelState(completedState, {
        log,
        calls,
        collapsed,
        setCollapsed,
      });

      expect(renderingResult.interactions.some((i) => i.id === INTERNAL_RENDER_CALL_ID)).toBe(true);
      expect(completedResult.interactions.some((i) => i.id === INTERNAL_RENDER_CALL_ID)).toBe(true);
    });

    it('excludes user interactions during rendering phase', () => {
      const renderingState = { ...baseState, status: 'rendering' as const };

      const result = getPanelState(renderingState, { log, calls, collapsed, setCollapsed });

      expect(result.interactions).toHaveLength(1);
      expect(result.interactions[0].id).toBe(INTERNAL_RENDER_CALL_ID);
    });

    it('includes user interactions after rendering phase', () => {
      const completedState = { ...baseState, status: 'completed' as const };

      const result = getPanelState(completedState, { log, calls, collapsed, setCollapsed });

      expect(result.interactions).toHaveLength(5);
      expect(result.interactions[0].id).toBe(INTERNAL_RENDER_CALL_ID);
      expect(result.interactions.slice(1).map((i) => i.id)).toEqual([
        'story--id [4] findByText',
        'story--id [5] click',
        'story--id [6] waitFor',
        'story--id [6] waitFor [2] toHaveBeenCalledWith',
      ]);
    });

    it('counts user interactions other than step methods', () => {
      const logWithSteps: LogItem[] = [
        {
          callId: INTERNAL_RENDER_CALL_ID,
          status: CallStates.DONE,
          ancestors: [],
        },
        {
          callId: 'story--id [1] click',
          status: CallStates.DONE,
          ancestors: [],
        },
        {
          callId: 'story--id [2] step',
          status: CallStates.DONE,
          ancestors: [],
        },
        {
          callId: 'story--id [3] type',
          status: CallStates.DONE,
          ancestors: [],
        },
      ];

      const callsWithSteps = new Map<Call['id'], Call>([
        [INTERNAL_RENDER_CALL_ID, calls.get(INTERNAL_RENDER_CALL_ID)!],
        [
          'story--id [1] click',
          {
            id: 'story--id [1] click',
            storyId: 'story--id',
            ancestors: [],
            cursor: 1,
            path: ['userEvent'],
            method: 'click',
            args: [],
            interceptable: true,
            retain: false,
          },
        ],
        [
          'story--id [2] step',
          {
            id: 'story--id [2] step',
            storyId: 'story--id',
            ancestors: [],
            cursor: 2,
            path: [],
            method: 'step',
            args: [],
            interceptable: false,
            retain: false,
          },
        ],
        [
          'story--id [3] type',
          {
            id: 'story--id [3] type',
            storyId: 'story--id',
            ancestors: [],
            cursor: 3,
            path: ['userEvent'],
            method: 'type',
            args: [],
            interceptable: true,
            retain: false,
          },
        ],
      ]);

      const completedState = { ...baseState, status: 'completed' as const };

      const result = getPanelState(completedState, {
        log: logWithSteps,
        calls: callsWithSteps,
        collapsed,
        setCollapsed,
      });

      expect(result.interactionsCount).toBe(2); // click and type (not render call or step method)
    });

    it('preserves input control states when processing user interactions', () => {
      const customControlStates = {
        detached: true,
        start: false,
        back: true,
        goto: false,
        next: true,
        end: false,
      };

      const stateWithCustomControls = {
        ...baseState,
        status: 'completed' as const,
        controlStates: customControlStates,
      };

      const result = getPanelState(stateWithCustomControls, {
        log,
        calls,
        collapsed,
        setCollapsed,
      });

      expect(result.controlStates).toEqual(customControlStates);
    });

    it('preserves input state properties in output', () => {
      const stateWithAllProps: PanelState = {
        ...baseState,
        status: 'completed' as const,
        hasException: true,
        pausedAt: 'some-call-id',
        caughtException: new Error('test error'),
        unhandledErrors: [{ name: 'Error', message: 'test error', stack: 'stack trace' }],
      };

      const result = getPanelState(stateWithAllProps, { log, calls, collapsed, setCollapsed });

      expect(result.status).toBe('completed');
      expect(result.hasException).toBe(true);
      expect(result.pausedAt).toBe('some-call-id');
      expect(result.caughtException).toEqual(new Error('test error'));
      expect(result.unhandledErrors).toEqual([
        { name: 'Error', message: 'test error', stack: 'stack trace' },
      ]);
    });
  });
});
