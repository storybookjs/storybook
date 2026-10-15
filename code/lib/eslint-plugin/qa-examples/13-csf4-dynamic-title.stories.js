// CSF factories are indexed the same way: a dynamic `title` breaks the file.
import preview from './.storybook/preview';
import { Button } from './Button';

const computeTitle = () => 'Example/Button';

const meta = preview.meta({
  title: computeTitle(),
  component: Button,
});

export const Primary = meta.story({});
