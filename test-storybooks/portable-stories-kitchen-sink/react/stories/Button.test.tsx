import { render, screen, cleanup } from '@testing-library/react';
import { addons } from 'storybook/internal/preview-api';

import { setProjectAnnotations, composeStories, composeStory } from '@storybook/react';
import * as stories from './Button.stories';

afterEach(() => {
  cleanup();
});

// example with composeStories, returns an object with all stories composed with args/decorators
const { CSF3Primary } = composeStories(stories);

// // example with composeStory, returns a single story composed with args/decorators
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
    let count = 0;
    // we don't use an actual spy so we can use this test between Jest and Vitest
    const onClickSpy = () => {
      count = count + 1;
    };
    render(<Secondary onClick={onClickSpy} />);
    const buttonElement = screen.getByRole('button');
    buttonElement.click();
    expect(count).toEqual(1);
  });

  it('reuses args from composeStories', () => {
    const { getByText } = render(<CSF3Primary />);
    const buttonElement = getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });
});

describe('projectAnnotations', () => {
  it('renders with default projectAnnotations', () => {
    const WithEnglishText = composeStory(stories.CSF2StoryWithLocale, stories.default);
    const { getByText } = render(<WithEnglishText />);
    const buttonElement = getByText('Hello!');
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom projectAnnotations via composeStory params', () => {
    const WithPortugueseText = composeStory(stories.CSF2StoryWithLocale, stories.default, {
      globalTypes: { locale: { defaultValue: 'pt' } },
    });
    const { getByText } = render(<WithPortugueseText />);
    const buttonElement = getByText('Olá!');
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom projectAnnotations via setProjectAnnotations', () => {
    setProjectAnnotations([{ parameters: { injected: true }, testingLibraryRender: render }]);
    const Story = composeStory(stories.CSF2StoryWithLocale, stories.default);
    expect(Story.parameters?.injected).toBe(true);
  });
});

describe('CSF3', () => {
  afterEach(() => {
    cleanup();
  });

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

  it('renders with play function', async () => {
    const CSF3InputFieldFilled = composeStory(stories.CSF3InputFieldFilled, stories.default);

    await CSF3InputFieldFilled.play();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
  });
});

// common in addons that need to communicate between manager and preview
it('should pass with decorators that need addons channel', () => {
  const PrimaryWithChannels = composeStory(stories.CSF3Primary, stories.default, {
    decorators: [
      (StoryFn) => {
        addons.getChannel();
        return StoryFn();
      },
    ],
  });
  render(<PrimaryWithChannels>Hello world</PrimaryWithChannels>);
  const buttonElement = screen.getByText(/Hello world/i);
  expect(buttonElement).not.toBeNull();
});

// Batch snapshot testing
const testCases = Object.values(composeStories(stories)).map((Story) => [Story.storyName, Story]);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  await Story.play();
  expect(document.body).toMatchSnapshot();
});
