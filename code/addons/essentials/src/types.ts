import type { BackgroundsParameters } from '@storybook/addon-backgrounds';
import type { HighlightParameters } from '@storybook/addon-highlight';
import type { MeasureParameters } from '@storybook/addon-measure';
import type { OutlineParameters } from '@storybook/addon-outline';

export interface EssentialsParameters
  extends BackgroundsParameters,
    HighlightParameters,
    MeasureParameters,
    OutlineParameters {}
