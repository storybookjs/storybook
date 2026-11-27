// The source import keeps `@storybook/svelte`'s renderer globals out of the harness type program,
// which also holds the Vue fixtures.
import { __definePreview } from '../../../../../../renderers/svelte/src/preview.ts';

export default __definePreview({ addons: [] });
