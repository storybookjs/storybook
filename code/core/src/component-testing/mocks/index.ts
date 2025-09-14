import { type Call, CallStates } from 'storybook/internal/instrumenter';

import { INTERNAL_RENDER_CALL_ID } from '../constants';

export const getCalls = (finalStatus: CallStates, slice?: number) => {
  let calls: Call[] = [
    {
      id: INTERNAL_RENDER_CALL_ID,
      storyId: 'story--id',
      cursor: 0,
      ancestors: [],
      path: [],
      method: 'render',
      args: [],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [3] step',
      storyId: 'story--id',
      cursor: 1,
      ancestors: [],
      path: [],
      method: 'step',
      args: ['Click button', { __function__: { name: '' } }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [3] step [1] within',
      storyId: 'story--id',
      cursor: 3,
      ancestors: ['story--id [3] step'],
      path: [],
      method: 'within',
      args: [{ __element__: { localName: 'div', id: 'root' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [3] step [2] findByText',
      storyId: 'story--id',
      cursor: 4,
      ancestors: ['story--id [3] step'],
      path: [{ __callId__: 'story--id [3] step [1] within' }],
      method: 'findByText',
      args: ['Click'],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [3] step [3] click',
      storyId: 'story--id',
      cursor: 5,
      ancestors: ['story--id [3] step'],
      path: ['userEvent'],
      method: 'click',
      args: [{ __element__: { localName: 'button', innerText: 'Click' } }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor',
      storyId: 'story--id',
      cursor: 6,
      ancestors: [],
      path: [],
      method: 'waitFor',
      args: [{ __function__: { name: '' } }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor [0] expect',
      storyId: 'story--id',
      cursor: 1,
      ancestors: ['story--id [6] waitFor'],
      path: [],
      method: 'expect',
      args: [{ __function__: { name: 'handleSubmit' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor [1] stringMatching',
      storyId: 'story--id',
      cursor: 2,
      ancestors: ['story--id [6] waitFor'],
      path: ['expect'],
      method: 'stringMatching',
      args: [{ __regexp__: { flags: 'gi', source: '([A-Z])w+' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [6] waitFor [2] toHaveBeenCalledWith',
      storyId: 'story--id',
      cursor: 3,
      ancestors: ['story--id [6] waitFor'],
      path: [{ __callId__: 'story--id [6] waitFor [0] expect' }],
      method: 'toHaveBeenCalledWith',
      args: [{ __callId__: 'story--id [6] waitFor [1] stringMatching', retain: false }],
      interceptable: true,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [7] expect',
      storyId: 'story--id',
      cursor: 7,
      ancestors: [],
      path: [],
      method: 'expect',
      args: [{ __function__: { name: 'handleReset' } }],
      interceptable: false,
      retain: false,
      status: CallStates.DONE,
    },
    {
      id: 'story--id [8] toHaveBeenCalled',
      storyId: 'story--id',
      cursor: 8,
      ancestors: [],
      path: [{ __callId__: 'story--id [7] expect' }, 'not'],
      method: 'toHaveBeenCalled',
      args: [],
      interceptable: true,
      retain: false,
      status: finalStatus,
    },
  ];

  if (typeof slice === 'number') {
    calls = slice < 0 ? calls.slice(slice) : calls.slice(0, slice);
  }

  if (finalStatus === CallStates.ERROR) {
    calls[calls.length - 1].status = finalStatus;
    calls[calls.length - 1].exception = {
      callId: calls[calls.length - 1].id,
      name: 'ReferenceError',
      message: 'ref is not defined',
      stack: `ReferenceError: ref is not defined
    at BaseModal (http://localhost:6006/core/src/components/components/Modal/Modal.tsx?t=1743533873995:33:5)
    at renderWithHooks (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:12199:26)
    at mountIndeterminateComponent (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:14949:21)
    at beginWork (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:15930:22)
    at beginWork$1 (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:19774:22)
    at performUnitOfWork (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:19219:20)
    at workLoopSync (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:19158:13)
    at renderRootSync (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:19137:15)
    at recoverFromConcurrentError (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:18754:28)
    at performConcurrentWorkOnRoot (http://localhost:6006/node_modules/.cache/storybook/da6a511058d185c3c92ed7790fc88078d8a947a8d0ac75815e8fd5704bcd4baa/sb-vite/deps/chunk-6FHVKFOZ.js?v=8ff74cdb:18702:30)`,
    };
  }

  return calls;
};

export const getInteractions = (finalStatus: CallStates) =>
  getCalls(finalStatus)
    .filter((call) => call.interceptable)
    .map((call) => ({
      ...call,
      childCallIds: [],
      isCollapsed: false,
      isHidden: false,
      toggleCollapsed: () => {},
    }));
