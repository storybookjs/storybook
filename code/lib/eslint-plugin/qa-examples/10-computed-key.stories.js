// A computed key named like a static property is misread as that property by the indexer.
import { Button } from './Button';

const title = 'parameters';

export default {
  [title]: { layout: 'fullscreen' },
  component: Button,
};

export const Primary = {};
