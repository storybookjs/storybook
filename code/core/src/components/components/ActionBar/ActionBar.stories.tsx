import type { ReactNode } from 'react';
import React from 'react';
import { action } from '@storybook/addon-actions';

import { ActionBar } from './ActionBar';

const action1 = action('action1');
const action2 = action('action2');
const action3 = action('action3');

export default {
  component: ActionBar,
  decorators: [
    (storyFn: () => ReactNode) => (
      <div
        style={{
          position: 'relative',
          width: '300px',
          height: '64px',
          margin: '1rem',
          background: 'papayawhip',
          border: '1px solid rgba(0,0,0,.05)',
        }}
      >
        {storyFn()}
      </div>
    ),
  ],
};

export const SingleItem = () => <ActionBar actionItems={[{ title: 'Clear', onClick: action1 }]} />;

export const ManyItems = () => (
  <ActionBar
    actionItems={[
      { title: 'Action string', onClick: action1 },
      { title: <div>Action node</div>, onClick: action2 },
      { title: 'Long action string', className: 'long-action-button', onClick: action3 },
    ]}
  />
);
