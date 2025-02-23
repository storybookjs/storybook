// @vitest-environment happy-dom

/* eslint-disable import/namespace */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { ProjectAnnotations } from 'storybook/internal/csf';
import { addons } from 'storybook/internal/preview-api';

import type { Meta, ReactRenderer } from '@storybook/react';

import * as addonActionsPreview from '@storybook/addon-actions/preview';

import { expectTypeOf } from 'expect-type';

import { composeStories, composeStory, setProjectAnnotations } from '..';
import type { Button } from './Button';
import * as ButtonStories from './Button.csf4.stories';
import * as ComponentWithErrorStories from './ComponentWithError.stories';

const HooksStory = composeStory(
  ButtonStories.HooksStory.input,
  ButtonStories.CSF3Primary.meta.input
);

const projectAnnotations = setProjectAnnotations([]);

// example with composeStories, returns an object with all stories composed with args/decorators
// @ts-expect-error TODO: add a way to provide custom args/argTypes
// eslint-disable-next-line prettier/prettier
const { CSF3Primary, LoaderStory, MountInPlayFunction, MountInPlayFunctionThrow } = composeStories(ButtonStories);
const { ThrowsError } = composeStories(ComponentWithErrorStories);

beforeAll(async () => {
  await projectAnnotations.beforeAll?.();
});

afterEach(() => {
  cleanup();
});

// example with composeStory, returns a single story composed with args/decorators
const Secondary = composeStory(
  ButtonStories.CSF2Secondary.input,
  ButtonStories.CSF3Primary.meta.input
);
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

  it('should throw error when rendering a component with a render error', async () => {
    await expect(() => ThrowsError.run()).rejects.toThrowError('Error in render');
  });

  it('should render component mounted in play function', async () => {
    await MountInPlayFunction.run();

    expect(screen.getByTestId('spy-data').textContent).toEqual('mockFn return value');
    expect(screen.getByTestId('loaded-data').textContent).toEqual('loaded data');
  });

  it('should throw an error in play function', async () => {
    await expect(() => MountInPlayFunctionThrow.run()).rejects.toThrowError('Error thrown in play');
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
  it('renders with default projectAnnotations', () => {
    setProjectAnnotations([
      {
        parameters: { injected: true },
        globalTypes: {
          locale: { defaultValue: 'en' },
        },
      },
    ]);
    const WithEnglishText = composeStory(
      ButtonStories.CSF2StoryWithLocale.input,
      ButtonStories.CSF3Primary.meta.input
    );
    const { getByText } = render(<WithEnglishText />);
    const buttonElement = getByText('Hello!');
    expect(buttonElement).not.toBeNull();
    expect(WithEnglishText.parameters?.injected).toBe(true);
  });

  it('renders with custom projectAnnotations via composeStory params', () => {
    const WithPortugueseText = composeStory(
      ButtonStories.CSF2StoryWithLocale.input,
      ButtonStories.CSF3Primary.meta.input,
      {
        initialGlobals: { locale: 'pt' },
      }
    );
    const { getByText } = render(<WithPortugueseText />);
    const buttonElement = getByText('Olá!');
    expect(buttonElement).not.toBeNull();
  });

  it('has action arg from argTypes when addon-actions annotations are added', () => {
    const Story = composeStory(
      ButtonStories.WithActionArgType.input,
      ButtonStories.CSF3Primary.meta.input,
      addonActionsPreview as ProjectAnnotations<ReactRenderer>
    );

    // TODO: add a way to provide custom args/argTypes, right now it's type any
    expect(Story.args.someActionArg).toHaveProperty('isAction', true);
  });
});

describe('CSF3', () => {
  it('renders with inferred globalRender', () => {
    const Primary = composeStory(
      ButtonStories.CSF3Button.input,
      ButtonStories.CSF3Primary.meta.input
    );

    render(<Primary>Hello world</Primary>);
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom render function', () => {
    const Primary = composeStory(
      ButtonStories.CSF3ButtonWithRender.input,
      ButtonStories.CSF3Primary.meta.input
    );

    render(<Primary />);
    expect(screen.getByTestId('custom-render')).not.toBeNull();
  });

  it('renders with play function without canvas element', async () => {
    const CSF3InputFieldFilled = composeStory(
      ButtonStories.CSF3InputFieldFilled.input,
      ButtonStories.CSF3Primary.meta.input
    );
    await CSF3InputFieldFilled.run();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
  });

  it('renders with play function with canvas element', async () => {
    const CSF3InputFieldFilled = composeStory(
      ButtonStories.CSF3InputFieldFilled.input,
      ButtonStories.CSF3Primary.meta.input
    );

    let divElement;
    try {
      divElement = document.createElement('div');
      document.body.appendChild(divElement);

      await CSF3InputFieldFilled.run({ canvasElement: divElement });

      const input = screen.getByTestId('input') as HTMLInputElement;
      expect(input.value).toEqual('Hello world!');
    } finally {
      if (divElement) {
        document.body.removeChild(divElement);
      }
    }
  });

  it('renders with hooks', async () => {
    await HooksStory.run();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
  });
});

// common in addons that need to communicate between manager and preview
it('should pass with decorators that need addons channel', () => {
  const PrimaryWithChannels = composeStory(
    ButtonStories.CSF3Primary.input,
    ButtonStories.CSF3Primary.meta.input,
    {
      decorators: [
        (StoryFn: any) => {
          addons.getChannel();
          return StoryFn();
        },
      ],
    }
  );
  render(<PrimaryWithChannels>Hello world</PrimaryWithChannels>);
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});

describe('ComposeStories types', () => {
  // this file tests Typescript types that's why there are no assertions
  it('Should support typescript operators', () => {
    type ComposeStoriesParam = Parameters<typeof composeStories>[0];

    expectTypeOf({
      ...ButtonStories,
      default: ButtonStories.CSF3Primary.meta.input as Meta<typeof Button>,
    }).toMatchTypeOf<ComposeStoriesParam>();

    expectTypeOf({
      ...ButtonStories,
      default: ButtonStories.CSF3Primary.meta.input satisfies Meta<typeof Button>,
    }).toMatchTypeOf<ComposeStoriesParam>();
  });
});

// @ts-expect-error TODO: fix the types for this
const testCases = Object.values(composeStories(ButtonStories)).map(
  // @ts-expect-error TODO: fix the types for this
  (Story) => [Story.storyName, Story] as [string, typeof Story]
);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  if (_storyName === 'CSF2StoryWithLocale' || _storyName === 'MountInPlayFunctionThrow') {
    return;
  }

  // @ts-expect-error TODO: fix the types for this
  await Story.run();
  expect(document.body).toMatchSnapshot();
});
