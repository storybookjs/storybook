import { setCoreAnnotations } from '@storybook/core/internal/csf';

import { getCoreAnnotations } from '../features/annotations.ts';

export * from '@storybook/core/preview-api';

// Runs in this entry's own file, which `sideEffects` lists, so bundlers keep the registration.
setCoreAnnotations(getCoreAnnotations);
