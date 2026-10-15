// A factory root named `preview` must come from a `.storybook/preview` file;
// this import path makes the indexer error on the whole file.
import preview from './titles';
import { Button } from './Button';

const meta = preview.meta({ component: Button });

export const Primary = meta.story({});
