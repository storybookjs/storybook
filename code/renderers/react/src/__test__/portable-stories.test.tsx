// @vitest-environment happy-dom

/* eslint-disable import/namespace */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import { addons } from 'storybook/internal/preview-api';

import type { Meta } from '@storybook/react';

import * as addonActionsPreview from '@storybook/addon-actions/preview';

import { expectTypeOf } from 'expect-type';

import { composeStories, composeStory, setProjectAnnotations } from '..';
import type { Button } from './Button';
import * as stories from './Button.stories';

setProjectAnnotations([]);

// example with composeStories, returns an object with all stories composed with args/decorators
const { CSF3Primary, LoaderStory, MountInPlayFunction } = composeStories(stories);

afterEach(() => {
  cleanup();
});

declare const globalThis: {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

// example with composeStory, returns a single story composed with args/decorators
const Secondary = composeStory(stories.CSF2Secondary, stories.default);
describe('renders', () => {
  it('renders primary button', () => {
    render(<CSF3Primary>Hello world</CSF3Primary>);
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).not.toBeNull();
  });

  it('reuses args from composed story', () => {
    render(<Secondary />);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement.textContent).toEqual(Secondary.args.children);
  });

  it('onclick handler is called', async () => {
    const onClickSpy = vi.fn();
    render(<Secondary onClick={onClickSpy} />);
    const buttonElement = screen.getByRole('button');
    buttonElement.click();
    expect(onClickSpy).toHaveBeenCalled();
  });

  it('reuses args from composeStories', () => {
    const { getByText } = render(<CSF3Primary />);
    const buttonElement = getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });

  it('should render component mounted in play function', async () => {
    await MountInPlayFunction.run();

    expect(screen.getByTestId('spy-data').textContent).toEqual('mockFn return value');
    expect(screen.getByTestId('loaded-data').textContent).toEqual('loaded data');
  });

  it('should call and compose loaders data', async () => {
    await LoaderStory.load();
    const { getByTestId } = render(<LoaderStory />);
    expect(getByTestId('spy-data').textContent).toEqual('mockFn return value');
    expect(getByTestId('loaded-data').textContent).toEqual('loaded data');
    // spy assertions happen in the play function and should work
    await LoaderStory.run!();
  });
});

describe('projectAnnotations', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with default projectAnnotations', () => {
    setProjectAnnotations([
      {
        parameters: { injected: true },
        globalTypes: {
          locale: { defaultValue: 'en' },
        },
      },
    ]);
    const WithEnglishText = composeStory(stories.CSF2StoryWithLocale, stories.default);
    const { getByText } = render(<WithEnglishText />);
    const buttonElement = getByText('Hello!');
    expect(buttonElement).not.toBeNull();
    expect(WithEnglishText.parameters?.injected).toBe(true);
  });

  it('renders with custom projectAnnotations via composeStory params', () => {
    const WithPortugueseText = composeStory(stories.CSF2StoryWithLocale, stories.default, {
      initialGlobals: { locale: 'pt' },
    });
    const { getByText } = render(<WithPortugueseText />);
    const buttonElement = getByText('Olá!');
    expect(buttonElement).not.toBeNull();
  });

  it('has action arg from argTypes when addon-actions annotations are added', () => {
    //@ts-expect-error our tsconfig.jsn#moduleResulution is set to 'node', which doesn't support this import
    const Story = composeStory(stories.WithActionArgType, stories.default, addonActionsPreview);
    expect(Story.args.someActionArg).toHaveProperty('isAction', true);
  });
});

describe('CSF3', () => {
  it('renders with inferred globalRender', () => {
    const Primary = composeStory(stories.CSF3Button, stories.default);

    render(<Primary>Hello world</Primary>);
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom render function', () => {
    const Primary = composeStory(stories.CSF3ButtonWithRender, stories.default);

    render(<Primary />);
    expect(screen.getByTestId('custom-render')).not.toBeNull();
  });

  it('renders with play function without canvas element', async () => {
    const CSF3InputFieldFilled = composeStory(stories.CSF3InputFieldFilled, stories.default);
    await CSF3InputFieldFilled.run();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
  });

  it('renders with play function with canvas element', async () => {
    const CSF3InputFieldFilled = composeStory(stories.CSF3InputFieldFilled, stories.default);

    const div = document.createElement('div');
    document.body.appendChild(div);

    await CSF3InputFieldFilled.run({ canvasElement: div });

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');

    document.body.removeChild(div);
  });

  it('renders with hooks', async () => {
    // TODO find out why act is not working here
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    const HooksStory = composeStory(stories.HooksStory, stories.default);

    await HooksStory.run();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });
});

// common in addons that need to communicate between manager and preview
it('should pass with decorators that need addons channel', () => {
  const PrimaryWithChannels = composeStory(stories.CSF3Primary, stories.default, {
    decorators: [
      (StoryFn: any) => {
        addons.getChannel();
        return StoryFn();
      },
    ],
  });
  render(<PrimaryWithChannels>Hello world</PrimaryWithChannels>);
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});

describe('ComposeStories types', () => {
  // this file tests Typescript types that's why there are no assertions
  it('Should support typescript operators', () => {
    type ComposeStoriesParam = Parameters<typeof composeStories>[0];

    expectTypeOf({
      ...stories,
      default: stories.default as Meta<typeof Button>,
    }).toMatchTypeOf<ComposeStoriesParam>();

    expectTypeOf({
      ...stories,
      default: stories.default satisfies Meta<typeof Button>,
    }).toMatchTypeOf<ComposeStoriesParam>();
  });
});

// Batch snapshot testing
const testCases = Object.values(composeStories(stories)).map(
  (Story) => [Story.storyName, Story] as [string, typeof Story]
);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  if (_storyName === 'CSF2StoryWithLocale') return;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  await Story.run();
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  expect(document.body).toMatchSnapshot();
});
