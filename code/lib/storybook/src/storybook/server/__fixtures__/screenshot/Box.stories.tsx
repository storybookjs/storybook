import React from 'react';

export default { title: 'Box' };

export const Filled = {
  render: () => <div style={{ width: 120, height: 80, background: 'rebeccapurple' }}>Box</div>,
};

export const Broken = {
  render: (): never => {
    throw new Error('Box cannot render');
  },
};

export const PlayFails = {
  render: () => <div>Box</div>,
  play: async (): Promise<void> => {
    throw new Error('Play went wrong');
  },
};
