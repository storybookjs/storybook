/* eslint-env browser */
import React from 'react';
import { createRoot } from 'react-dom/client';

import { global } from '@storybook/global';

import { addons } from 'storybook/preview-api';

import { HighlightOverlay } from './HighlightOverlay';

const { document } = global;

const root = document.createElement('div');
root.id = 'storybook-addon-highlight-root';
document.body.appendChild(root);

const channel = addons.getChannel();
createRoot(root).render(<HighlightOverlay channel={channel} />);
