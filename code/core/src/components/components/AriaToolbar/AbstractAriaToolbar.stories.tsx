import { Button } from 'storybook/internal/components';

import preview from '../../../../../.storybook/preview';
import { AbstractAriaToolbar } from './AriaToolbar';

const Children = () => (
  <>
    <Button key="button1">Button 1</Button>
    <Button key="button2">Button 2</Button>
    <Button key="button3">Button 3</Button>
    <Button key="button4">Button 4</Button>
    <Button key="button5">Button 5</Button>
    <Button key="button6">Button 6</Button>
    <Button key="button7">Button 7</Button>
    <Button key="button8">Button 8</Button>
  </>
);

const meta = preview.meta({
  title: 'AbstractAriaToolbar',
  component: AbstractAriaToolbar,
  args: {
    children: <Children />,
  },
});

export const Basic = meta.story({});
