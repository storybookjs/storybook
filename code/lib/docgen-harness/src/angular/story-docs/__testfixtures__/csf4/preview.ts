// The public definePreview lives in the framework's client entry, which this package's strict
// program cannot compile; the core factory it wraps is enough for the parser.
import { definePreview } from 'storybook/internal/csf';

import type { AngularRenderer } from '../../../csf-types.ts';

export default definePreview<AngularRenderer, []>({ addons: [] });
