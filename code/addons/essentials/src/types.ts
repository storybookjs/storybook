import type { ActionsParameters } from '@storybook/addon-actions';
import type { BackgroundsParameters } from '@storybook/addon-backgrounds';
import type { DocsParameters } from '@storybook/addon-docs';
import type { HighlightParameters } from '@storybook/addon-highlight';
import type { MeasureParameters } from '@storybook/addon-measure';
import type { OutlineParameters } from '@storybook/addon-outline';
import type { ViewportParameters } from '@storybook/addon-viewport';

export interface EssentialsParameters
  extends ActionsParameters,
    BackgroundsParameters,
    DocsParameters,
    HighlightParameters,
    MeasureParameters,
    OutlineParameters,
    ViewportParameters {}
