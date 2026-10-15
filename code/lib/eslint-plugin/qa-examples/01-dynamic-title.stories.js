// `title` from a function call: the indexer cannot read it and the whole file fails to index.
import { Button } from './Button';

const computeTitle = () => `Example/${Button.name}`;

export default {
  title: computeTitle(),
  component: Button,
};

export const Primary = {};
