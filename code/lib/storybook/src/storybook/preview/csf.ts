import { setCoreAnnotations } from '@storybook/core/internal/csf';
import { getCoreAnnotations } from '../../features/annotations.ts';

export * from '@storybook/core/internal/csf';
export * from '../../features/index.ts';
export { getCoreAnnotations } from '@storybook/core/internal/csf';
export type { CoreTypes } from '../../features/index.ts';

setCoreAnnotations(getCoreAnnotations);
