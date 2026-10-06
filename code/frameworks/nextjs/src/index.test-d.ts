import type { ComponentType } from 'react';

import { definePreview } from './index.ts';

type Props = { label: string; optional?: boolean; onAction: () => void };
declare const Button: ComponentType<Props>;

const preview = definePreview({});
const meta = preview.meta({ component: Button, args: { label: 'Save', onAction: () => {} } });

meta.story({ args: { optional: false } });

// @ts-expect-error optional must be boolean
meta.story({ args: { optional: 'no' } });

const incomplete = preview.meta({ component: Button, args: { label: 'Save' } });
// @ts-expect-error onAction is required when meta does not provide it
incomplete.story({ args: { optional: false } });
