// `hierarchy-separator` now also sees CSF factory metas.
import preview from './.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({
  title: 'Example|Button',
  component: Button,
});

export const Primary = meta.story({});
