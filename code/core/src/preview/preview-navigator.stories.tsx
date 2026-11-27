import type { StoryIndex } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { expect, fn, within } from 'storybook/test';

import { setupPreviewNavigator, teardownPreviewNavigator } from './preview-navigator.ts';

type StoryArgs = {
  currentStoryId: string;
};

const meta = {
  parameters: {
    layout: 'fullscreen',
  },
  render: (args) => {
    return <div className="storybook-root">This is the story content</div>;
  },
  args: {
    currentStoryId: 'input--text',
  },
} satisfies Meta<StoryArgs>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockIndex: StoryIndex = {
  entries: {
    'button--primary': {
      id: 'button--primary',
      title: 'Button',
      name: 'Primary',
      type: 'story',
      subtype: 'story',
      importPath: './button/Button.stories.ts',
    },
    'button--secondary': {
      id: 'button--secondary',
      title: 'Button',
      name: 'Secondary',
      type: 'story',
      subtype: 'story',
      importPath: './button/Button.stories.ts',
    },
    'input--text': {
      id: 'input--text',
      title: 'Forms/Input',
      name: 'Text',
      type: 'story',
      subtype: 'story',
      importPath: './components/input/Input.stories.ts',
    },
    'input--number': {
      id: 'input--number',
      title: 'Forms/Input',
      name: 'Number',
      type: 'story',
      subtype: 'story',
      importPath: './components/input/Input.stories.ts',
    },
    'checkbox--default': {
      id: 'checkbox--default',
      title: 'Forms/Checkbox',
      name: 'Default',
      type: 'story',
      subtype: 'story',
      importPath: './components/checkbox/Checkbox.stories.ts',
    },
    'select--basic': {
      id: 'select--basic',
      title: 'Forms/Select',
      name: 'Basic',
      type: 'story',
      subtype: 'story',
      importPath: './components/select/Select.stories.ts',
    },
  },
  v: 4,
};

export const Default: Story = {
  beforeEach: ({ args }) => {
    teardownPreviewNavigator();
    setupPreviewNavigator(mockIndex, args.currentStoryId);

    document.querySelectorAll('.sb-navigator-story-link').forEach((link) => {
      link.addEventListener(
        'click',
        fn((event) => {
          event.preventDefault();
        }).mockName('story-link-click')
      );
    });

    return teardownPreviewNavigator;
  },
};

const specialCharactersIndex: StoryIndex = {
  entries: {
    'select--bold': {
      id: 'select--bold',
      title: 'Forms/<Select> & "Co"',
      name: '<b>Bold</b>',
      type: 'story',
      subtype: 'story',
      importPath: './components/select/Select.stories.ts',
    },
    'button--primary': {
      id: 'button--primary',
      title: 'Button',
      name: 'Primary',
      type: 'story',
      subtype: 'story',
      importPath: './button/Button.stories.ts',
    },
  },
  v: 4,
};

/**
 * Story titles and names can contain HTML characters like `<`, `&` and `"`. Those must render
 * as literal text in the navigator, not as markup.
 */
export const SpecialCharacters: Story = {
  args: {
    currentStoryId: 'select--bold',
  },
  beforeEach: ({ args }) => {
    teardownPreviewNavigator();
    setupPreviewNavigator(specialCharactersIndex, args.currentStoryId);

    return teardownPreviewNavigator;
  },
  play: async () => {
    const body = within(document.body);

    expect(body.getByRole('link', { name: '<b>Bold</b>' })).toBeInTheDocument();
    expect(body.getByRole('list', { name: '<Select> & "Co"' })).toBeInTheDocument();
    expect(document.querySelector('#sb-navigator-container b')).toBeNull();
  },
};
