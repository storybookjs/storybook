import { type Call, CallStates } from '@storybook/instrumenter';

export const getCalls = (finalStatus: CallStates) => {
  const calls: Call[] = [
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

  if (finalStatus === CallStates.ERROR) {
    calls[calls.length - 1].exception = {
      name: 'Error',
      stack: '',
      message: 'Oops!',
      callId: calls[calls.length - 1].id,
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
