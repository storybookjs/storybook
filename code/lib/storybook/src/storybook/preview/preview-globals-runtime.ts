import * as CHANNELS from '@storybook/core/internal/channels';
import * as CLIENT_LOGGER from '@storybook/core/internal/client-logger';
import * as CORE_EVENTS from '@storybook/core/internal/core-events';
import * as CORE_EVENTS_PREVIEW_ERRORS from '@storybook/core/internal/preview-errors';
import * as TYPES from '@storybook/core/internal/types';

import * as GLOBAL from '@storybook/global';

import * as ACTIONS from 'storybook/actions';
import * as PREVIEW_API from '@storybook/core/preview-api';
import * as TEST from '@storybook/core/test';

import type { globalsNameReferenceMap } from '@storybook/core/internal/preview/globals';

// Here we map the name of a module to their VALUE in the global scope.
export const globalsNameValueMap: Required<Record<keyof typeof globalsNameReferenceMap, any>> = {
  '@storybook/global': GLOBAL,

  'storybook/test': TEST,
  'storybook/actions': ACTIONS,
  'storybook/preview-api': PREVIEW_API,

  'storybook/internal/channels': CHANNELS,
  'storybook/internal/client-logger': CLIENT_LOGGER,
  'storybook/internal/core-events': CORE_EVENTS,
  'storybook/internal/types': TYPES,
  'storybook/internal/preview-errors': CORE_EVENTS_PREVIEW_ERRORS,
  'storybook/internal/preview-api': PREVIEW_API,
};
