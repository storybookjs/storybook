// The `.meta()` argument must be an inline object (or a local `const` holding one);
// anything else makes the indexer treat the meta as empty.
import preview from './.storybook/preview';
import { Button } from './Button';

const buildMeta = () => ({ component: Button });

const meta = preview.meta(buildMeta());

export const Primary = meta.story({});
