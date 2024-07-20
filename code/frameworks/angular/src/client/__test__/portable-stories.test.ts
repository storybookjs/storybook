// @vitest-environment happy-dom

/// <reference types="@testing-library/jest-dom" />;
import { it, expect, vi, describe, afterEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { expectTypeOf } from 'expect-type';
import { Meta } from '..';
import * as stories from './button.stories';
import { ButtonComponent } from './button.component';
import { composeStories, composeStory, setProjectAnnotations } from '../portable-stories';
import { createMountable } from '../angular-beta/StandaloneRenderer';

setProjectAnnotations({ testingLibraryRender: render as any });

// example with composeStories, returns an object with all stories composed with args/decorators
const { CSF3Primary, LoaderStory } = composeStories(stories);

// example with composeStory, returns a single story composed with args/decorators
const Secondary = composeStory(stories.CSF2Secondary, stories.default);
describe('renders', () => {
  it('renders primary button with custom props via composeStory', async () => {
    // We unfortunately can't do the following:
    // render(CSF3Primary.Component, { ...CSF3Primary.props, label: 'Hello world' });
    // Because the props will be passed to the first decorator of the story instead
    // of the actual component of the story. This is because of our current PreviewRender structure

    const Composed = composeStory(
      {
        ...stories.CSF3Primary,
        args: { ...stories.CSF3Primary.args, label: 'Hello world' },
      },
      stories.default
    );

    const { component, applicationConfig } = createMountable(Composed());
    await render(component, { providers: applicationConfig.providers });
    const buttonElement = await screen.getByText(/Hello world/i);
    await expect(buttonElement).not.toBeNull();
  });

  it('reuses args from composed story', async () => {
    const { component, applicationConfig } = createMountable(Secondary());
    await render(component, { providers: applicationConfig.providers });
    const buttonElement = screen.getByRole('button');
    await expect(buttonElement.textContent).toMatch(Secondary.args.label);
  });

  it('onclick handler is called', async () => {
    const onClickSpy = vi.fn();
    const { component, applicationConfig } = createMountable(Secondary({ onClick: onClickSpy }));
    await render(component, { providers: applicationConfig.providers });
    const buttonElement = screen.getByRole('button');
    buttonElement.click();
    expect(onClickSpy).toHaveBeenCalled();
  });

  it('reuses args from composeStories', async () => {
    const { component, applicationConfig } = createMountable(CSF3Primary());
    const { getByText } = await render(component, { providers: applicationConfig.providers });
    const buttonElement = getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });

  it('should call and compose loaders data', async () => {
    await LoaderStory.load();
    const { component, applicationConfig } = createMountable(LoaderStory());
    const { getByTestId } = await render(component, { providers: applicationConfig.providers });
    await expect(getByTestId('spy-data').textContent).toEqual('mockFn return value');
    await expect(getByTestId('loaded-data').textContent).toEqual('loaded data');
    // spy assertions happen in the play function and should work
    await LoaderStory.play!();
  });
});

// describe('projectAnnotations', () => {
//   it('renders with default projectAnnotations', async () => {
//     setProjectAnnotations([
//       {
//         parameters: { injected: true },
//         globalTypes: {
//           locale: { defaultValue: 'en' },
//         },
//         testingLibraryRender: render as any,
//       },
//     ]);
//     const WithEnglishText = composeStory(stories.CSF2StoryWithLocale, stories.default);
//     const { component, applicationConfig } = createMountable(WithEnglishText());
//     const { getByText } = await render(component, { providers: applicationConfig.providers });
//     const buttonElement = getByText('Hello!');
//     expect(buttonElement).not.toBeNull();
//     expect(WithEnglishText.parameters?.injected).toBe(true);
//   });

//   it('renders with custom projectAnnotations via composeStory params', async () => {
//     const WithPortugueseText = composeStory(stories.CSF2StoryWithLocale, stories.default, {
//       initialGlobals: { locale: 'pt' },
//     });
//     const { component, applicationConfig } = createMountable(WithPortugueseText());
//     const { getByText } = await render(component, { providers: applicationConfig.providers });
//     const buttonElement = getByText('Olá!');
//     expect(buttonElement).not.toBeNull();
//   });
// });

describe('CSF3', () => {
  it('renders with inferred globalRender', async () => {
    const Primary = composeStory(stories.CSF3Button, stories.default);
    const { component, applicationConfig } = createMountable(Primary());
    await render(component, { providers: applicationConfig.providers });
    const buttonElement = screen.getByText(/foo/i);
    expect(buttonElement).not.toBeNull();
  });

  it('renders with custom render function', async () => {
    const Primary = composeStory(stories.CSF3ButtonWithRender, stories.default);

    const { component, applicationConfig } = createMountable(Primary());
    await render(component, { providers: applicationConfig.providers });
    expect(screen.getByTestId('custom-render')).not.toBeNull();
  });

  it('renders with play function without canvas element', async () => {
    const CSF3InputFieldFilled = composeStory(stories.CSF3InputFieldFilled, stories.default);

    await CSF3InputFieldFilled.play();

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');
  });

  it('renders with play function with canvas element', async () => {
    const CSF3InputFieldFilled = composeStory(stories.CSF3InputFieldFilled, stories.default);

    const div = document.createElement('div');
    document.body.appendChild(div);

    await CSF3InputFieldFilled.play({ canvasElement: div });

    const input = screen.getByTestId('input') as HTMLInputElement;
    expect(input.value).toEqual('Hello world!');

    document.body.removeChild(div);
  });
});

describe('ComposeStories types', () => {
  // this file tests Typescript types that's why there are no assertions
  it('Should support typescript operators', () => {
    type ComposeStoriesParam = Parameters<typeof composeStories>[0];

    expectTypeOf({
      ...stories,
      default: stories.default as Meta<ButtonComponent>,
    }).toMatchTypeOf<ComposeStoriesParam>();

    expectTypeOf({
      ...stories,

      /**
       * Types of property 'argTypes' are incompatible.
       * Type '{ backgroundColor: { control: string; }; size: { control: { type: string; }; options: string[]; }; }'
       * has no properties in common with type 'Partial<ArgTypes<ComponentType>>'.
       */
      default: stories.default satisfies Meta<ButtonComponent>,
    }).toMatchTypeOf<ComposeStoriesParam>();
  });
});

// Batch snapshot testing
const testCases = Object.values(composeStories(stories)).map(
  (Story) => [Story.storyName, Story] as [string, typeof Story]
);
it.each(testCases)('Renders %s story', async (_storyName, Story) => {
  if (_storyName === 'CSF2StoryWithLocale') return;
  await Story.play();
  expect(document.body).toMatchSnapshot();
});
