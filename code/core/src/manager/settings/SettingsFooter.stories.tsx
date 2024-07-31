import React from 'react';

import type { Decorator } from '@storybook/react';
import SettingsFooter from './SettingsFooter';

export default {
  component: SettingsFooter,
  title: 'Settings/SettingsFooter',
  decorators: [
    ((StoryFn, c) => (
      <div style={{ width: '600px', margin: '2rem auto' }}>
        <StoryFn {...c} />
      </div>
    )) as Decorator,
  ],
};

export const Basic = () => <SettingsFooter />;
