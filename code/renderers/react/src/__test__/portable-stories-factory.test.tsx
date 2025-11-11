// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

import {
  CSF2Secondary,
  CSF2StoryWithLocale,
  CSF3Button,
  CSF3ButtonWithRender,
  CSF3InputFieldFilled,
  CSF3Primary,
  HooksStory,
  MountInPlayFunction,
  MountInPlayFunctionThrow,
} from './Button.csf4.stories';

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

const testCases = Object.entries({
  CSF2StoryWithLocale,
  CSF3Button,
  CSF3ButtonWithRender,
  CSF3InputFieldFilled,
  CSF3Primary,
  MountInPlayFunction,
}).map(([name, Story]) => [name, Story] as [string, typeof Story]);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  await Story.run();
  expect(document.body).toMatchSnapshot();
});
