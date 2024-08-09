import type { Call } from '@storybook/instrumenter';
import React from 'react';
import { styled, typography } from 'storybook/internal/theming';
import { Node, MethodCall } from './MethodCall';

const StyledWrapper = styled.div(({ theme }) => ({
  backgroundColor: theme.background.content,
  padding: '20px',
  boxShadow: `0 0 0 1px ${theme.appBorderColor}`,
  color: theme.color.defaultText,
  fontFamily: typography.fonts.mono,
  fontSize: typography.size.s1,
}));

export default {
  title: 'MethodCall',
  component: MethodCall,
  decorators: [
    (Story: any) => (
      <StyledWrapper>
        <Story />
      </StyledWrapper>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export const Args = () => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 10 }}>
    <Node value={null} />
    <Node value={undefined} />
    <Node value="Hello world" />
    <Node value="https://github.com/storybookjs/storybook/blob/next/README.md" />
    <Node value="012345678901234567890123456789012345678901234567890123456789" />
    {}
    <Node value={true} />
    <Node value={false} />
    <Node value={12345} />
    <Node value={['foo', 1, { hello: 'world' }]} />
    <Node value={[...Array(23)].map((_, i) => i)} />
    <Node value={{ hello: 'world' }} />
    <Node value={{ hello: 'world', arr: [1, 2, 3], more: true }} />
    <Node value={{ hello: 'world', arr: [1, 2, 3], more: true }} showObjectInspector />
    <Node
      value={{
        hello: 'world',
        arr: [1, 2, 3],
        more: true,
        regex: /regex/,
        class: class DummyClass {},
        fn: () => 123,
        asyncFn: async () => 'hello',
      }}
      showObjectInspector
    />
    <Node value={{ __class__: { name: 'FooBar' } }} />
    <Node value={{ __function__: { name: 'goFaster' } }} />
    <Node value={{ __function__: { name: '' } }} />
    <Node value={{ __element__: { localName: 'hr' } }} />
    <Node value={{ __element__: { localName: 'foo', prefix: 'x' } }} />
    <Node value={{ __element__: { localName: 'div', id: 'foo' } }} />
    <Node value={{ __element__: { localName: 'span', classNames: ['foo', 'bar'] } }} />
    <Node value={{ __element__: { localName: 'button', innerText: 'Click me' } }} />
    <Node
      value={{ __date__: { value: new Date(Date.UTC(2012, 11, 20, 0, 0, 0)).toISOString() } }}
    />
    <Node value={{ __date__: { value: new Date(1600000000000).toISOString() } }} />
    <Node value={{ __date__: { value: new Date(1600000000123).toISOString() } }} />
    <Node value={{ __date__: { value: new Date(1600000000123) } }} />
    <Node value={{ __error__: { name: 'EvalError', message: '' } }} />
    <Node value={{ __error__: { name: 'SyntaxError', message: "Can't do that" } }} />
    <Node
      value={{
        __error__: { name: 'TypeError', message: "Cannot read property 'foo' of undefined" },
      }}
    />
    <Node
      value={{
        __error__: { name: 'ReferenceError', message: 'Invalid left-hand side in assignment' },
      }}
    />
    <Node
      value={{
        __error__: {
          name: 'Error',
          message:
            "XMLHttpRequest cannot load https://example.com. No 'Access-Control-Allow-Origin' header is present on the requested resource.",
        },
      }}
    />
    <Node value={{ __regexp__: { flags: 'i', source: 'hello' } }} />
    <Node value={{ __regexp__: { flags: '', source: 'src(.*)\\.js$' } }} />
    <Node value={{ __symbol__: { description: '' } }} />
    <Node value={{ __symbol__: { description: 'Hello world' } }} />
  </div>
);

const calls: Call[] = [
  {
    cursor: 0,
    id: '1',
    ancestors: [],
    path: ['screen'],
    method: 'getByText',
    storyId: 'kind--story',
    args: ['Click'],
    interceptable: false,
    retain: false,
  },
  {
    cursor: 1,
    id: '2',
    ancestors: [],
    path: ['userEvent'],
    method: 'click',
    storyId: 'kind--story',
    args: [{ __callId__: '1' }],
    interceptable: true,
    retain: false,
  },
  {
    cursor: 2,
    id: '3',
    ancestors: [],
    path: [],
    method: 'expect',
    storyId: 'kind--story',
    args: [true],
    interceptable: true,
    retain: false,
  },
  {
    cursor: 3,
    id: '4',
    ancestors: [],
    path: [{ __callId__: '3' }, 'not'],
    method: 'toBe',
    storyId: 'kind--story',
    args: [false],
    interceptable: true,
    retain: false,
  },
  {
    cursor: 4,
    id: '5',
    ancestors: [],
    path: ['jest'],
    method: 'fn',
    storyId: 'kind--story',
    args: [{ __function__: { name: 'actionHandler' } }],
    interceptable: false,
    retain: false,
  },
  {
    cursor: 5,
    id: '6',
    ancestors: [],
    path: [],
    method: 'expect',
    storyId: 'kind--story',
    args: [{ __callId__: '5' }],
    interceptable: false,
    retain: false,
  },
  {
    cursor: 6,
    id: '7',
    ancestors: [],
    path: ['expect'],
    method: 'stringMatching',
    storyId: 'kind--story',
    args: [{ __regexp__: { flags: 'i', source: 'hello' } }],
    interceptable: false,
    retain: false,
  },
  {
    cursor: 7,
    id: '8',
    ancestors: [],
    path: [{ __callId__: '6' }, 'not'],
    method: 'toHaveBeenCalledWith',
    storyId: 'kind--story',
    args: [
      { __callId__: '7' },
      [
        { __error__: { name: 'Error', message: "Cannot read property 'foo' of undefined" } },
        { __symbol__: { description: 'Hello world' } },
      ],
    ],
    interceptable: false,
    retain: false,
  },
  {
    cursor: 8,
    id: '9',
    ancestors: [],
    path: [],
    method: 'step',
    storyId: 'kind--story',
    args: ['Custom step label', { __function__: { name: '' } }],
    interceptable: true,
    retain: false,
  },
];

const callsById = calls.reduce((acc, call) => {
  acc.set(call.id, call);
  return acc;
}, new Map<Call['id'], Call>());

export const Step = () => <MethodCall call={callsById.get('9')} callsById={callsById} />;
export const Simple = () => <MethodCall call={callsById.get('1')} callsById={callsById} />;
export const Nested = () => <MethodCall call={callsById.get('2')} callsById={callsById} />;
export const Chained = () => <MethodCall call={callsById.get('4')} callsById={callsById} />;
export const Complex = () => <MethodCall call={callsById.get('8')} callsById={callsById} />;
