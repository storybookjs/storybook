// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import React from 'react';

import type { Meta } from '@storybook/react';

import { expectTypeOf } from 'expect-type';
import { addons } from 'storybook/preview-api';

import { composeStories, composeStory, setProjectAnnotations } from '..';
import type { Button } from './Button';
import * as ButtonStories from './Button.csf4.stories';
import {
  CSF2StoryWithLocale,
  CSF3Button,
  CSF3ButtonWithRender,
  CSF3InputFieldFilled,
  CSF3Primary,
  MountInPlayFunction,
  MountInPlayFunctionThrow,
} from './Button.csf4.stories';
import { CSF2Secondary, HooksStory } from './Button.csf4.stories';

afterEach(() => {
  cleanup();
});

describe('renders', () => {
  it('renders primary button', () => {
    render(<CSF2Secondary.Component primary={true}>Hello world</CSF2Secondary.Component>);
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).not.toBeNull();
  });

  it('reuses args from composed story', () => {
    render(<CSF2Secondary.Component />);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement.textContent).toEqual(CSF2Secondary.input.args.children);
  });

  it('onclick handler is called', async () => {
    const onClickSpy = vi.fn();
    render(<CSF2Secondary.Component onClick={onClickSpy} />);
    const buttonElement = screen.getByRole('button');
    buttonElement.click();
    expect(onClickSpy).toHaveBeenCalled();
  });

  it('reuses args from composeStories', () => {
    const { getByText } = render(<CSF3Primary.Component />);
    const buttonElement = getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });

  it('should render component mounted in play function', async () => {
    await MountInPlayFunction.run();

    expect(screen.getByTestId('spy-data').textContent).toEqual('mockFn return value');
    expect(screen.getByTestId('loaded-data').textContent).toEqual('loaded data');
  });

  it('should throw an error in play function', async () => {
    await expect(() => MountInPlayFunctionThrow.run()).rejects.toThrowError('Error thrown in play');
  });
});

describe('projectAnnotations', () => {
  it('renders with default projectAnnotations', () => {
    setProjectAnnotations([
      {
        parameters: { injected: true },
        initialGlobals: {
          locale: 'en',
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
      ButtonStories.CSF3Primary.meta.input
    );

    // TODO: add a way to provide custom args/argTypes, right now it's type any
    // expect(Story.args.someActionArg).toHaveProperty('isAction', true);
  });
});

describe('CSF3', () => {
  it('renders with inferred globalRender', () => {
    render(<CSF3Button.Component>Hello world</CSF3Button.Component>);
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom render function', () => {
    render(<CSF3ButtonWithRender.Component />);
    expect(screen.getByTestId('custom-render')).not.toBeNull();
  });

  it('renders with play function without canvas element', async () => {
    await CSF3InputFieldFilled.run();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
  });

  it('renders with play function with canvas element', async () => {
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
  });
});

// @ts-expect-error TODO: fix the types for this
const testCases = Object.values(composeStories(ButtonStories)).map(
  // @ts-expect-error TODO: fix the types for this
  (Story) => [Story.storyName, Story] as [string, typeof Story]
);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  if (
    _storyName === 'LoaderStory' ||
    _storyName === 'Modal' ||
    _storyName === 'CSF2StoryWithLocale' ||
    _storyName === 'MountInPlayFunctionThrow'
  ) {
    return;
  }

  // @ts-expect-error TODO: fix the types for this
  await Story.run();
  expect(document.body).toMatchSnapshot();
});
