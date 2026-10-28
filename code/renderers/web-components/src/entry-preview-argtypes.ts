import { enhanceArgTypes } from 'storybook/internal/docs-tools';
import type { ArgTypesEnhancer } from 'storybook/internal/types';

import { getFeatures } from 'storybook/preview-api';

import { extractArgTypes, extractComponentDescription } from './docs/custom-elements.ts';
import type { WebComponentsRenderer } from './types.ts';

const useServiceArgTypes = getFeatures().docgenServer;

export const parameters = useServiceArgTypes
  ? {}
  : {
      docs: {
        extractArgTypes,
        extractComponentDescription,
      },
    };

export const argTypesEnhancers: ArgTypesEnhancer<WebComponentsRenderer>[] = [enhanceArgTypes];
