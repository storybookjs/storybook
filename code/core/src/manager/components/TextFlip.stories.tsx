import preview from '../../../../.storybook/preview';
import { Button } from '../../components';
import { TextFlip } from './TextFlip';

const meta = preview.meta({
  component: TextFlip,
  args: {
    text: 'Use controls to change this',
    placeholder: 'This is some long placeholder text',
  },
  render: (args) => (
    <Button>
      <TextFlip {...args} />
    </Button>
  ),
});

export const Default = meta.story({});
