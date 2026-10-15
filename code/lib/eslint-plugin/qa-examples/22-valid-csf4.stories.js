// Fully valid CSF4 file for contrast: nothing to report.
import preview from './.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  title: 'Example/Button',
  component: Button,
  tags: ['autodocs'],
});

export const Primary = meta.story({});

export const Secondary = meta.story({
  name: 'The Secondary Button',
  tags: ['snapshot'],
});
