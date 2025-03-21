import React from 'react';

import preview from '../../../.storybook/preview';
import { Highlights } from './Highlights';

const meta = preview.meta({
  component: Highlights,
  decorators: [
    (Story) => (
      <>
        <div
          id="moving"
          style={{
            position: 'absolute',
            top: 100,
            left: 100,
            width: 200,
            height: 150,
            border: '1px solid black',
            borderRadius: 10,
          }}
        />
        <div
          id="scaling"
          style={{
            position: 'absolute',
            top: 50,
            left: '50%',
            width: 200,
            height: 150,
            border: '1px solid black',
            borderRadius: 10,
          }}
        >
          <div
            id="inner"
            style={{
              position: 'absolute',
              top: '25%',
              left: '25%',
              width: 120,
              height: '50%',
              border: '1px solid black',
              borderRadius: 10,
            }}
          />
        </div>
        <Story />
      </>
    ),
  ],
});

export const Default = meta.story({
  args: {
    selectors: ['div'],
  },
  play: async ({ canvasElement }) => {
    const scaling = canvasElement.querySelector('#scaling') as HTMLElement;
    const moving = canvasElement.querySelector('#moving') as HTMLElement;
    setInterval(() => {
      scaling.style.height = `${parseInt(scaling.style.height) + 5}px`;
      moving.style.left = `${parseInt(moving.style.left) + 5}px`;
    }, 1000);
  },
});
