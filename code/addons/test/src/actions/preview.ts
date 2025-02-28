import { definePreview } from 'storybook/internal/preview-api';

import { ACTIONS_PARAM_KEY } from './constants';

export const parameters = {
  [ACTIONS_PARAM_KEY]: { argTypesRegex: '^on[A-Z].*' },
};

export const withActions = () =>
  definePreview({
    parameters,
  });
