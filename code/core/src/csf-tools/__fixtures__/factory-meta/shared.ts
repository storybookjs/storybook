const title = 'Shared/Button';
const tags = ['test', 'shared-meta'];

export const sharedMeta = {
  title,
  tags,
  id: 'shared-button',
  excludeStories: ['Excluded'],
  component: Button,
  render: () => title,
};

export default sharedMeta;
import { Button } from './component.ts';
