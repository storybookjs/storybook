import React from 'react';

import type { Decorator } from '@storybook/react-vite';

import SettingsFooter from './SettingsFooter.tsx';

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
