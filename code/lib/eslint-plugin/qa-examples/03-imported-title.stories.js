// The indexer only follows constants declared in the same file, never imports.
import { Button } from './Button';
import { BUTTON_TITLE } from './titles';

export default {
  title: BUTTON_TITLE,
  component: Button,
};

export const Primary = {};
