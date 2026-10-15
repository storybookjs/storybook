// The indexer reads `title: 'Example/Button'`, but at runtime `baseMeta` can override it:
// the sidebar and the rendered story can disagree. Static properties belong after spreads.
import { Button } from './Button';
import { baseMeta } from './titles';

export default {
  title: 'Example/Button',
  ...baseMeta,
  component: Button,
};

export const Primary = {};
