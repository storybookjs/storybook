// `no-redundant-story-name` now checks factory stories.
import preview from './.storybook/preview';
import { Button } from './Button';

const meta = preview.meta({ component: Button });

export const PrimaryButton = meta.story({ name: 'Primary Button' });
