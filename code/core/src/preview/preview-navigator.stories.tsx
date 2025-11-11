import type { StoryIndex } from 'storybook/internal/types';

import type { Meta, StoryObj } from '@storybook/react-vite';

import { fn } from 'storybook/test';

import { setupPreviewNavigator, teardownPreviewNavigator } from './preview-navigator';

const meta: Meta = {
  parameters: {
    layout: 'fullscreen',
  },
  render: () => {
    return <div className="storybook-root">This is the story content</div>;
  },
  args: {
    currentStoryId: 'input--text',
  },
};

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
