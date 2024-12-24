import React from 'react';
import { storiesOf } from '@storybook/react';
import ComponentRow from './ComponentRow';
import * as SpecRowStories from './SpecRow.stories';

export const { actions } = SpecRowStories;

storiesOf('ComponentRow', module).add('pending', () => (
  <ComponentRow snapshots={snapshots.pending} buildNumber={2} {...actions} />
));
