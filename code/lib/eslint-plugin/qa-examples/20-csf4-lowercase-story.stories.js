// `prefer-pascal-case` now checks factory stories (and ignores non-story exports).
import preview from './.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({ component: Button });

export const primary = meta.story({});
