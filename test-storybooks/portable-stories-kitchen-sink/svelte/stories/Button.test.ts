/// <reference types="@testing-library/jest-dom" />;
import { it, expect, vi, describe, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
// import '@testing-library/svelte/vitest';
import * as stories from './Button.stories';
// import type Button from './Button.svelte';
import { composeStories, composeStory, setProjectAnnotations } from '@storybook/svelte';

setProjectAnnotations({ testingLibraryRender: render });

// example with composeStories, returns an object with all stories composed with args/decorators
const { CSF3Primary, LoaderStory } = composeStories(stories);

// example with composeStory, returns a single story composed with args/decorators
const Secondary = composeStory(stories.CSF2Secondary, stories.default);
describe('renders', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders primary button with custom props via composeStory', () => {
    // We unfortunately can't do the following:
    // render(CSF3Primary.Component, { ...CSF3Primary.props, label: 'Hello world' });
    // Because the props will be passed to the first decorator of the story instead
    // of the actual component of the story. This is because of our current PreviewRender structure

    const composedStory = composeStory(
      {
        ...stories.CSF3Primary,
        args: { ...stories.CSF3Primary.args, label: 'Hello world' },
      },
      stories.default
    );

    render(composedStory.Component, composedStory.props);
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).not.toBeNull();
  });

  it('reuses args from composed story', () => {
    render(Secondary.Component, Secondary.props);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement.textContent).toMatch(Secondary.args.label);
  });

  it('reuses args from composeStories', () => {
    const { getByText } = render(CSF3Primary.Component, CSF3Primary.props);
    const buttonElement = getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });

  it('should call and compose loaders data', async () => {
    await LoaderStory.load();
    const { getByTestId } = render(LoaderStory.Component, LoaderStory.props);
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
        testingLibraryRender: render,
      },
    ]);
    const WithEnglishText = composeStory(stories.CSF2StoryWithLocale, stories.default);
    const { getByText } = render(WithEnglishText.Component, WithEnglishText.props);
    const buttonElement = getByText('Hello!');
    expect(buttonElement).not.toBeNull();
    expect(WithEnglishText.parameters?.injected).toBe(true);
  });

  it('renders with custom projectAnnotations via composeStory params', () => {
    const WithPortugueseText = composeStory(stories.CSF2StoryWithLocale, stories.default, {
      initialGlobals: { locale: 'pt' },
    });
    const { getByText } = render(WithPortugueseText.Component, WithPortugueseText.props);
    const buttonElement = getByText('Olá!');
    expect(buttonElement).not.toBeNull();
  });
});

describe('CSF3', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders with inferred globalRender', () => {
    const Primary = composeStory(stories.CSF3Button, stories.default);

    render(Primary.Component, Primary.props);
    const buttonElement = screen.getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom render function', () => {
    const Primary = composeStory(stories.CSF3ButtonWithRender, stories.default);

    render(Primary.Component, Primary.props);
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
});

// // Batch snapshot testing
const testCases = Object.values(composeStories(stories)).map(
  (Story) => [Story.storyName, Story] as [string, typeof Story]
);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  if (_storyName === 'CSF2StoryWithLocale') return;
  await Story.run();
  expect(document.body).toMatchSnapshot();
});
