import Button from '../components/Button.astro';

export default {
  title: 'Example/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    label: { control: 'text' },
    primary: { control: 'boolean' },
  },
};

export const Primary = {
  args: { label: 'Button', primary: true },
};

export const Secondary = {
  args: { label: 'Button' },
};
