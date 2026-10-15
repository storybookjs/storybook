// Valid: a top-level `const` holding a string literal is resolved by the indexer.
import { Button } from './Button';

const TITLE = 'Example/Button';

export default {
  title: TITLE,
  component: Button,
};

export const Primary = {};
