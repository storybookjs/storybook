import preview from '../../../../.storybook/preview';
import { TextFlip } from './TextFlip';

const meta = preview.meta({
  component: TextFlip,
  args: {
    text: 'Hello',
  },
  render: (args) => (
    <div style={{ display: 'inline-block', border: '1px solid red' }}>
      <TextFlip {...args} />
    </div>
  ),
});

export const Default = meta.story({});
