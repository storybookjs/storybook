import type { ProjectAnnotations } from 'storybook/internal/types';
import { ReactRenderer, setProjectAnnotations } from '@storybook/react';
import sbAnnotations from '../.storybook/preview';
import * as addonInteractions from '@storybook/addon-interactions/preview';

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<ReactRenderer>, // instruments actions as spies
]);
