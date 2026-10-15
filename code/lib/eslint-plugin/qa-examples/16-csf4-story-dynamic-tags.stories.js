// Dynamic tags on a factory story are invisible to the indexer and to test filtering.
import preview from './.storybook/preview';
import { Button } from './Button';

const storyTags = () => ['snapshot'];

const meta = preview.meta({ component: Button });

export const Primary = meta.story({
  tags: storyTags(),
});
