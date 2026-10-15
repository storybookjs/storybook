// `csf-component` now also sees CSF factory metas.
import preview from './.storybook/preview';

const meta = preview.meta({ title: 'Example/Button' });

export const Primary = meta.story({});
