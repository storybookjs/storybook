import React from 'react';

import { Loader } from './Loader';

const withBackground = (storyFn: any) => (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background:
        'linear-gradient(to right, rgba(56,56,56,1) 0%, rgba(0,0,0,1) 50%, rgba(255,255,255,1) 50%, rgba(224,224,224,1) 100%)',
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        height: '50vh',
        width: '100vw',
        background: 'linear-gradient(to right, red 0%, orangered 50%, blue 50%, deepskyblue 100%)',
      }}
    />
    {storyFn()}
  </div>
);

export default {
  component: Loader,
};

export const InfiniteState = () => <Loader role="progressbar" />;
InfiniteState.decorators = [withBackground];

export const SizeAdjusted = () => <Loader size={64} role="progressbar" />;
SizeAdjusted.decorators = [withBackground];

export const ProgressBar = () => (
  <Loader progress={{ value: 0.3, message: 'Building', modules: { complete: 500, total: 1337 } }} />
);

export const ProgressError = () => <Loader error={new Error('Connection closed')} />;
