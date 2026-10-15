// Story-level tags are also read statically; dynamic ones break indexing and test filtering.
import { Button } from './Button';

const storyTags = () => ['snapshot'];

export default {
  component: Button,
};

export const Primary = {
  tags: storyTags(),
};
