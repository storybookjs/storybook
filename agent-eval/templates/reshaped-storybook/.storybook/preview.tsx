import type { Preview } from '@storybook/react-vite';
import React from 'react';
import { mswLoader } from 'msw-storybook-addon/csf3';
import { Reshaped } from 'reshaped';
import 'reshaped/themes/slate/theme.css';

const preview: Preview = {
  decorators: [
    (Story) => (
      <Reshaped theme="slate">
        <Story />
      </Reshaped>
    ),
  ],
  loaders: [mswLoader()],
};

export default preview;
