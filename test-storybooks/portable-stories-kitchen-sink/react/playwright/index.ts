import type { ProjectAnnotations } from 'storybook/internal/types';
import { ReactRenderer, setProjectAnnotations } from '@storybook/react';
import sbAnnotations from '../.storybook/preview';
import * as addonInteractions from '@storybook/addon-interactions/preview';
import * as addonActions from '@storybook/addon-essentials/actions/preview';

setProjectAnnotations([
  sbAnnotations,
  addonInteractions as ProjectAnnotations<ReactRenderer>, // instruments actions as spies
  addonActions as ProjectAnnotations<ReactRenderer>, // creates actions from argTypes
]);
