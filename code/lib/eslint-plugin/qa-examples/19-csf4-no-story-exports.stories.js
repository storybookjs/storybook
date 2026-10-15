// `story-exports` now understands factory files: only `meta.story()` / `meta.extend()`
// exports are stories, so this file has none.
import preview from './.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({ component: Button });

export const mockData = { label: 'hello' };
