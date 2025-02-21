import type { ActionsTypes } from '@storybook/addon-actions';
import type { BackgroundTypes } from '@storybook/addon-backgrounds';
import type { DocsTypes } from '@storybook/addon-docs';
import type { HighLightTypes } from '@storybook/addon-highlight';
import type { MeasureTypes } from '@storybook/addon-measure';
import type { OutlineTypes } from '@storybook/addon-outline';
import type { ViewportTypes } from '@storybook/addon-viewport';

export type EssentialsTypes = ActionsTypes &
  BackgroundTypes &
  DocsTypes &
  HighLightTypes &
  MeasureTypes &
  OutlineTypes &
  ViewportTypes;
