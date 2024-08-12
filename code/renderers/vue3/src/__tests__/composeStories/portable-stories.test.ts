// @vitest-environment happy-dom
/// <reference types="@testing-library/jest-dom" />;
import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';

import { addons } from 'storybook/internal/preview-api';

import type { Meta } from '@storybook/vue3';

import { expectTypeOf } from 'expect-type';

import { composeStories, composeStory, setProjectAnnotations } from '../../portable-stories';
import * as stories from './Button.stories';
import type Button from './Button.vue';

setProjectAnnotations([]);

// example with composeStories, returns an object with all stories composed with args/decorators
const { CSF3Primary, LoaderStory } = composeStories(stories);

// example with composeStory, returns a single story composed with args/decorators
const Secondary = composeStory(stories.CSF2Secondary, stories.default);

describe('renders', () => {
  it('renders primary button', () => {
    render(CSF3Primary, { props: { label: 'Hello world' } });
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('reuses args from composed story', () => {
    render(Secondary);
    const buttonElement = screen.getByRole('button');
    expect(buttonElement.textContent).toEqual(Secondary.args.label);
  });

  it('myClickEvent handler is called', async () => {
    const myClickEventSpy = vi.fn();
    render(Secondary, { props: { onMyClickEvent: myClickEventSpy } });
    const buttonElement = screen.getByRole('button');
    buttonElement.click();
    expect(myClickEventSpy).toHaveBeenCalled();
  });

  it('reuses args from composeStories', () => {
    const { getByText } = render(CSF3Primary);
    const buttonElement = getByText(/foo/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('should call and compose loaders data', async () => {
    await LoaderStory.load();
    const { getByTestId } = render(LoaderStory);
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
    const WithEnglishText = composeStory(stories.CSF2StoryWithLocale, stories.default);
    const { getByText } = render(WithEnglishText);
    const buttonElement = getByText('Hello!');
    expect(buttonElement).toBeInTheDocument();
    expect(WithEnglishText.parameters?.injected).toBe(true);
  });

  it('renders with custom projectAnnotations via composeStory params', () => {
    const WithPortugueseText = composeStory(stories.CSF2StoryWithLocale, stories.default, {
      initialGlobals: { locale: 'pt' },
    });
    const { getByText } = render(WithPortugueseText);
    const buttonElement = getByText('Olá!');
    expect(buttonElement).toBeInTheDocument();
  });
});

describe('CSF3', () => {
  it('renders with inferred globalRender', () => {
    const Primary = composeStory(stories.CSF3Button, stories.default);

    render(Primary, { props: { label: 'Hello world' } });
    const buttonElement = screen.getByText(/Hello world/i);
    expect(buttonElement).toBeInTheDocument();
  });

  it('renders with custom render function', () => {
    const Primary = composeStory(stories.CSF3ButtonWithRender, stories.default);

    render(Primary);
    expect(screen.getByTestId('custom-render')).toBeInTheDocument();
  });

  it('renders with play function', async () => {
    const CSF3InputFieldFilled = composeStory(stories.CSF3InputFieldFilled, stories.default);

    await CSF3InputFieldFilled.run();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
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
  render(PrimaryWithChannels, { props: { label: 'Hello world' } });
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});

describe('ComposeStories types', () => {
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
const testCases = Object.values(composeStories(stories)).map((Story) => [Story.storyName, Story]);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  if (typeof Story === 'string' || _storyName === 'CSF2StoryWithLocale') return;
  await Story.run();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(document.body).toMatchSnapshot();
});
