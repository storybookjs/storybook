import preview from '../../.storybook/preview';

import { View } from 'react-native';
import { fn } from 'storybook/test';

import { Button } from './Button';

const meta = preview.meta({
  title: 'Example/Button',
  component: Button,
  decorators: [
    (Story) => (
      <View style={{ flex: 1, alignItems: 'flex-start' }}>
        <Story />
      </View>
    ),
  ],
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ['autodocs'],
  // Use `fn` to spy on the onPress arg, which will appear in the actions panel once invoked: https://storybook.js.org/docs/essentials/actions#story-args
  args: { onPress: fn() },
});

export const Primary = meta.story({
  args: {
    primary: true,
    label: 'Button',
  },
});

export const Secondary = meta.story({
  args: {
    label: 'Button',
  },
});

export const Large = meta.story({
  args: {
    size: 'large',
    label: 'Button',
  },
});

export const Small = meta.story({
  args: {
    size: 'small',
    label: 'Button',
  },
});
