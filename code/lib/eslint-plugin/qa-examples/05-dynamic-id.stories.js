// Unlike `title`, the `id` property accepts only an inline string literal — no constants.
import { Button } from './Button';

const ID = 'example-button';

export default {
  id: ID,
  component: Button,
};

export const Primary = {};
