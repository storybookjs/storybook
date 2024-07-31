/* eslint-disable no-underscore-dangle */
import type { FC, PropsWithChildren } from 'react';
import React, { StrictMode, createElement, Profiler } from 'react';
import type { Mock } from 'vitest';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PropTypes from 'prop-types';
import { addons, useEffect } from 'storybook/internal/preview-api';
import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import { renderJsx, jsxDecorator, getReactSymbolName } from './jsxDecorator';

vi.mock('storybook/internal/preview-api');
const mockedAddons = vi.mocked(addons);
const mockedUseEffect = vi.mocked(useEffect);

expect.addSnapshotSerializer({
  print: (val: any) => val,
  test: (val) => typeof val === 'string',
});

describe('converts React Symbol to displayName string', () => {
  const symbolCases = [
    ['react.suspense', 'React.Suspense'],
    ['react.strict_mode', 'React.StrictMode'],
    ['react.server_context.defaultValue', 'React.ServerContext.DefaultValue'],
  ];

  it.each(symbolCases)('"%s" to "%s"', (symbol, expectedValue) => {
    expect(getReactSymbolName(Symbol(symbol))).toEqual(expectedValue);
  });
});

describe('renderJsx', () => {
  it('basic', () => {
    expect(renderJsx(<div>hello</div>, {})).toMatchInlineSnapshot(`
      <div>
        hello
      </div>
    `);
  });
  it('functions', () => {
    const onClick = () => console.log('onClick');
    expect(renderJsx(<div onClick={onClick}>hello</div>, {})).toMatchInlineSnapshot(`
      <div onClick={() => {}}>
        hello
      </div>
    `);
  });
  it('undefined values', () => {
    expect(renderJsx(<div className={undefined}>hello</div>, {})).toMatchInlineSnapshot(`
      <div>
        hello
      </div>
    `);
  });
  it('null values', () => {
    expect(renderJsx(<div>hello</div>, {})).toMatchInlineSnapshot(`
      <div>
        hello
      </div>
    `);
  });
  it('large objects', () => {
    const obj = Array.from({ length: 20 }).reduce((acc, _, i) => {
      // @ts-expect-error (Converted from ts-ignore)
      acc[`key_${i}`] = `val_${i}`;
      return acc;
    }, {});
    expect(renderJsx(<div data-val={obj} />, {})).toMatchInlineSnapshot(`
      <div
        data-val={{
          key_0: 'val_0',
          key_1: 'val_1',
          key_10: 'val_10',
          key_11: 'val_11',
          key_12: 'val_12',
          key_13: 'val_13',
          key_14: 'val_14',
          key_15: 'val_15',
          key_16: 'val_16',
          key_17: 'val_17',
          key_18: 'val_18',
          key_19: 'val_19',
          key_2: 'val_2',
          key_3: 'val_3',
          key_4: 'val_4',
          key_5: 'val_5',
          key_6: 'val_6',
          key_7: 'val_7',
          key_8: 'val_8',
          key_9: 'val_9'
        }}
       />
    `);
  });

  it('long arrays', () => {
    const arr = Array.from({ length: 20 }, (_, i) => `item ${i}`);
    expect(renderJsx(<div data-val={arr} />, {})).toMatchInlineSnapshot(`
      <div
        data-val={[
          'item 0',
          'item 1',
          'item 2',
          'item 3',
          'item 4',
          'item 5',
          'item 6',
          'item 7',
          'item 8',
          'item 9',
          'item 10',
          'item 11',
          'item 12',
          'item 13',
          'item 14',
          'item 15',
          'item 16',
          'item 17',
          'item 18',
          'item 19'
        ]}
       />
    `);
  });

  describe('forwardRef component', () => {
    it('with no displayName', () => {
      const MyExoticComponentRef = React.forwardRef<FC, PropsWithChildren>(
        function MyExoticComponent(props, _ref) {
          return <div>{props.children}</div>;
        }
      );

      expect(renderJsx(<MyExoticComponentRef>I am forwardRef!</MyExoticComponentRef>))
        .toMatchInlineSnapshot(`
          <React.ForwardRef>
            I am forwardRef!
          </React.ForwardRef>
        `);
    });

    it('with displayName coming from docgen', () => {
      const MyExoticComponentRef = React.forwardRef<FC, PropsWithChildren>(
        function MyExoticComponent(props, _ref) {
          return <div>{props.children}</div>;
        }
      );
      (MyExoticComponentRef as any).__docgenInfo = {
        displayName: 'ExoticComponent',
      };
      expect(renderJsx(<MyExoticComponentRef>I am forwardRef!</MyExoticComponentRef>))
        .toMatchInlineSnapshot(`
          <ExoticComponent>
            I am forwardRef!
          </ExoticComponent>
        `);
    });

    it('with displayName coming from forwarded render function', () => {
      const MyExoticComponentRef = React.forwardRef<FC, PropsWithChildren>(
        Object.assign(
          function MyExoticComponent(props: any, _ref: any) {
            return <div>{props.children}</div>;
          },
          { displayName: 'ExoticComponent' }
        )
      );
      expect(renderJsx(<MyExoticComponentRef>I am forwardRef!</MyExoticComponentRef>))
        .toMatchInlineSnapshot(`
        <ExoticComponent>
          I am forwardRef!
        </ExoticComponent>
      `);
    });
  });

  it('memo component', () => {
    const MyMemoComponentRef: FC<PropsWithChildren> = React.memo(function MyMemoComponent(props) {
      return <div>{props.children}</div>;
    });

    expect(renderJsx(<MyMemoComponentRef>I am memo!</MyMemoComponentRef>)).toMatchInlineSnapshot(`
      <React.Memo>
        I am memo!
      </React.Memo>
    `);

    // if docgenInfo is present, it should use the displayName from there
    (MyMemoComponentRef as any).__docgenInfo = {
      displayName: 'MyMemoComponentRef',
    };
    expect(renderJsx(<MyMemoComponentRef>I am memo!</MyMemoComponentRef>)).toMatchInlineSnapshot(`
      <MyMemoComponentRef>
        I am memo!
      </MyMemoComponentRef>
    `);
  });

  it('Profiler', () => {
    expect(
      renderJsx(
        <Profiler id="profiler-test" onRender={() => {}}>
          <div>I am in a Profiler</div>
        </Profiler>,
        {}
      )
    ).toMatchInlineSnapshot(`
      <React.Profiler
        id="profiler-test"
        onRender={() => {}}
      >
        <div>
          I am in a Profiler
        </div>
      </React.Profiler>
    `);
  });

  it('StrictMode', () => {
    expect(renderJsx(<StrictMode>I am StrictMode</StrictMode>, {})).toMatchInlineSnapshot(`
      <React.StrictMode>
        I am StrictMode
      </React.StrictMode>
    `);
  });

  it('displayName coming from docgenInfo', () => {
    function BasicComponent({ label }: any) {
      return <button>{label}</button>;
    }
    BasicComponent.__docgenInfo = {
      description: 'Some description',
      methods: [],
      displayName: 'Button',
      props: {},
    };

    expect(
      renderJsx(
        createElement(
          BasicComponent,
          {
            label: <p>Abcd</p>,
          },
          undefined
        )
      )
    ).toMatchInlineSnapshot(`<Button label={<p>Abcd</p>} />`);
  });

  it('Suspense', () => {
    expect(
      renderJsx(
        <React.Suspense fallback={null}>
          <div>I am in Suspense</div>
        </React.Suspense>,
        {}
      )
    ).toMatchInlineSnapshot(`
      <React.Suspense fallback={null}>
        <div>
          I am in Suspense
        </div>
      </React.Suspense>
    `);
  });

  it('should not add default props to string if the prop value has not changed', () => {
    const Container = ({ className, children }: { className: string; children: string }) => {
      return <div className={className}>{children}</div>;
    };

    Container.propTypes = {
      children: PropTypes.string.isRequired,
      className: PropTypes.string,
    };

    Container.defaultProps = {
      className: 'super-container',
    };

    expect(renderJsx(<Container>yo dude</Container>, {})).toMatchInlineSnapshot(`
      <Container className="super-container">
        yo dude
      </Container>
    `);
  });
});

// @ts-expect-error (Converted from ts-ignore)
const makeContext = (name: string, parameters: any, args: any, extra?: object): StoryContext => ({
  id: `jsx-test--${name}`,
  kind: 'js-text',
  name,
  parameters,
  unmappedArgs: args,
  args,
  ...extra,
});

describe('jsxDecorator', () => {
  let mockChannel: { on: Mock; emit?: Mock };
  beforeEach(() => {
    mockedAddons.getChannel.mockReset();
    mockedUseEffect.mockImplementation((cb) => setTimeout(() => cb(), 0));

    mockChannel = { on: vi.fn(), emit: vi.fn() };
    mockedAddons.getChannel.mockReturnValue(mockChannel as any);
  });

  it('should render dynamically for args stories', async () => {
    const storyFn = (args: any) => <div>args story</div>;
    const context = makeContext('args', { __isArgsStory: true }, {});
    jsxDecorator(storyFn, context);
    await new Promise((r) => setTimeout(r, 0));
    expect(mockChannel.emit).toHaveBeenCalledWith(SNIPPET_RENDERED, {
      id: 'jsx-test--args',
      args: {},
      source: '<div>\n  args story\n</div>',
    });
  });

  it('should not render decorators when provided excludeDecorators parameter', async () => {
    const storyFn = (args: any) => <div>args story</div>;
    const decoratedStoryFn = (args: any) => (
      <div style={{ padding: 25, border: '3px solid red' }}>{storyFn(args)}</div>
    );
    const context = makeContext(
      'args',
      {
        __isArgsStory: true,
        docs: {
          source: {
            excludeDecorators: true,
          },
        },
      },
      {},
      { originalStoryFn: storyFn }
    );
    jsxDecorator(decoratedStoryFn, context);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockChannel.emit).toHaveBeenCalledWith(SNIPPET_RENDERED, {
      id: 'jsx-test--args',
      args: {},
      source: '<div>\n  args story\n</div>',
    });
  });

  it('should skip dynamic rendering for no-args stories', async () => {
    const storyFn = () => <div>classic story</div>;
    const context = makeContext('classic', {}, {});
    jsxDecorator(storyFn, context);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockChannel.emit).not.toHaveBeenCalled();
  });

  it('renders MDX properly', async () => {
    // FIXME: generate this from actual MDX
    const mdxElement: ReturnType<typeof createElement> = {
      // @ts-expect-error (Converted from ts-ignore)
      type: { displayName: 'MDXCreateElement' },
      props: {
        mdxType: 'div',
        originalType: 'div',
        className: 'foo',
      },
    };

    jsxDecorator(() => mdxElement, makeContext('mdx-args', { __isArgsStory: true }, {}));
    await new Promise((r) => setTimeout(r, 0));

    expect(mockChannel.emit).toHaveBeenCalledWith(SNIPPET_RENDERED, {
      id: 'jsx-test--mdx-args',
      args: {},
      source: '<div className="foo" />',
    });
  });

  it('handles stories that trigger Suspense', async () => {
    // if a story function uses a hook or other library that triggers suspense, it will throw a Promise until it is resolved
    // and then it will return the story content after the promise is resolved
    const storyFn = vi.fn();
    storyFn
      .mockImplementationOnce(() => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw Promise.resolve();
      })
      .mockImplementation(() => {
        return <div>resolved args story</div>;
      });
    const jsx = '';
    const context = makeContext('args', { __isArgsStory: true, jsx }, {});
    expect(() => {
      jsxDecorator(storyFn, context);
    }).toThrow(Promise);
    jsxDecorator(storyFn, context);
    await new Promise((r) => setTimeout(r, 0));

    expect(mockChannel.emit).toHaveBeenCalledTimes(2);
    expect(mockChannel.emit).nthCalledWith(1, SNIPPET_RENDERED, {
      id: 'jsx-test--args',
      args: {},
      source: '',
    });
    expect(mockChannel.emit).nthCalledWith(2, SNIPPET_RENDERED, {
      id: 'jsx-test--args',
      args: {},
      source: '<div>\n  resolved args story\n</div>',
    });
  });
});
