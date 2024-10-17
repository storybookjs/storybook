// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { type Call, CallStates, type LogItem } from '@storybook/instrumenter';

import { getInteractions } from './Panel';

describe('Panel', () => {
  describe('getInteractions', () => {
    const log: LogItem[] = [
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

    it('returns list of interactions', () => {
      expect(getInteractions({ log, calls, collapsed, setCollapsed })).toEqual([
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
      const withError = log.slice(0, 3).concat({ ...log[3], status: CallStates.ERROR });

      expect(getInteractions({ log: withError, calls, collapsed, setCollapsed })).toEqual([
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
      const withActiveError = log.slice(0, 2).concat([
        { ...log[2], status: CallStates.ACTIVE },
        { ...log[3], status: CallStates.ERROR },
      ]);

      expect(getInteractions({ log: withActiveError, calls, collapsed, setCollapsed })).toEqual([
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
      const withActiveWaiting = log.slice(0, 2).concat([
        { ...log[2], status: CallStates.ACTIVE },
        { ...log[3], status: CallStates.WAITING },
      ]);

      expect(getInteractions({ log: withActiveWaiting, calls, collapsed, setCollapsed })).toEqual([
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
});
