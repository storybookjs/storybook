// `includeStories` / `excludeStories` accept only literals: a string, regex, or array of strings.
import { Button } from './Button';

const included = ['Primary'];

export default {
  component: Button,
  includeStories: included,
};

export const Primary = {};
