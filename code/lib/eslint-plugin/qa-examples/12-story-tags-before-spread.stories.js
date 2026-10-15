// Same index/runtime divergence as in the meta: the spread can override the tags at runtime.
import { Button } from './Button';
import { baseMeta } from './titles';

export default {
  component: Button,
};

export const Primary = {
  tags: ['snapshot'],
  ...baseMeta,
};
