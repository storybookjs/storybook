// @vitest-environment happy-dom

import { html, render } from 'lit';
import type { Mock } from 'vitest';
import { describe, beforeEach, it, vi, expect } from 'vitest';
import { styleMap } from 'lit/directives/style-map.js';
import { addons, useEffect } from 'storybook/internal/preview-api';
import { SNIPPET_RENDERED } from 'storybook/internal/docs-tools';
import type { StoryContext } from '../types';
import { sourceDecorator } from './sourceDecorator';

vi.mock('storybook/internal/preview-api');
const mockedAddons = vi.mocked(addons);
const mockedUseEffect = vi.mocked(useEffect);

expect.addSnapshotSerializer({
  print: (val: any) => val,
  test: (val) => typeof val === 'string',
});

const tick = () => new Promise((r) => setTimeout(r, 0));

const makeContext = (name: string, parameters: any, args: any, extra?: Partial<StoryContext>) =>
  ({
    id: `lit-test--${name}`,
    kind: 'js-text',
    name,
    parameters,
    unmappedArgs: args,
    args,
    argTypes: {},
    globals: {},
    ...extra,
  }) as StoryContext;

describe('sourceDecorator', () => {
  let mockChannel: { on: Mock; emit?: Mock };
  beforeEach(() => {
    mockedAddons.getChannel.mockReset();
    mockedUseEffect.mockImplementation((cb) => setTimeout(() => cb(), 0));

    mockChannel = { on: vi.fn(), emit: vi.fn() };
    mockedAddons.getChannel.mockReturnValue(mockChannel as any);
  });

  it('should render dynamically for args stories', async () => {
    const storyFn = (args: any) => html`<div>args story</div>`;
    const context = makeContext('args', { __isArgsStory: true }, {});
    sourceDecorator(storyFn, context);
    await tick();
    expect(mockChannel.emit).toHaveBeenCalledWith(SNIPPET_RENDERED, {
      id: 'lit-test--args',
      args: {},
      source: '<div>args story</div>',
    });
  });

  it('should skip dynamic rendering for no-args stories', async () => {
    const storyFn = () => html`<div>classic story</div>`;
    const context = makeContext('classic', {}, {});
    sourceDecorator(storyFn, context);
    await tick();
    expect(mockChannel.emit).not.toHaveBeenCalled();
  });

  it('should use the originalStoryFn if excludeDecorators is set', async () => {
    const storyFn = (args: any) => html`<div>args story</div>`;
    const decoratedStoryFn = (args: any) => html`
      <div style=${styleMap({ padding: `${25}px`, border: '3px solid red' })}>${storyFn(args)}</div>
    `;
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
    sourceDecorator(decoratedStoryFn, context);
    await tick();
    expect(mockChannel.emit).toHaveBeenCalledWith(SNIPPET_RENDERED, {
      id: 'lit-test--args',
      args: {},
      source: '<div>args story</div>',
    });
  });

  it('should handle document fragment without removing its child nodes', async () => {
    const storyFn = () =>
      html`my
        <div>args story</div>`;
    const decoratedStoryFn = () => {
      const fragment = document.createDocumentFragment();
      render(storyFn(), fragment);
      return fragment;
    };
    const context = makeContext('args', { __isArgsStory: true }, {});
    const story = sourceDecorator(decoratedStoryFn, context);
    await tick();
    expect(mockChannel.emit).toHaveBeenCalledWith(SNIPPET_RENDERED, {
      id: 'lit-test--args',
      args: {},
      source: `my
        <div>args story</div>`,
    });
    expect(story).toMatchInlineSnapshot(`
      <DocumentFragment>
        <!---->
        my
              
        <div>
          args story
        </div>
      </DocumentFragment>
    `);
  });
});
