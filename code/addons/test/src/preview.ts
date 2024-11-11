import { addons } from 'storybook/internal/preview-api';
import type { PlayFunction, StepLabel, StoryContext } from 'storybook/internal/types';

import { instrument } from '@storybook/instrumenter';
// This makes sure that storybook test loaders are always loaded when addon-interactions is used
// For 9.0 we want to merge storybook/test and addon-interactions into one addon.
import '@storybook/test';

import { getUniversalState } from './constants';
import { useUniversalState } from './use-universal-state-preview';

export const { step: runStep } = instrument(
  {
    // It seems like the label is unused, but the instrumenter has access to it
    // The context will be bounded later in StoryRender, so that the user can write just:
    // await step("label", (context) => {
    //   // labeled step
    // });
    step: async (label: StepLabel, play: PlayFunction, context: StoryContext) => play(context),
  },
  { intercept: true }
);

export const parameters = {
  throwPlayFunctionExceptions: false,
};

const myUniversalState = getUniversalState(addons.getChannel());

myUniversalState.subscribe((state) => {
  console.log('PREVIEW: State updated: \n', JSON.stringify(state, null, 2));
});

setInterval(() => {
  myUniversalState.state = {
    message: 'PREVIEW TIMER: updated state',
    randomNumber: Math.random(),
  };
}, 12_000);

// export const decorators = [
//   (StoryFn) => {
//     const [universalState, setUniversalState] = useUniversalState(myUniversalState);

//     const existingPanel = document.getElementById('universal-state-debugger');
//     if (existingPanel) {
//       existingPanel.innerHTML = `
//       <pre>
//       <code>${JSON.stringify(universalState, null, 2)}</code>
//       </pre>
//     `;
//       return StoryFn();
//     }

//     const debuggingPanel = document.createElement('div');
//     debuggingPanel.id = 'universal-state-debugger';
//     debuggingPanel.style.position = 'fixed';
//     debuggingPanel.style.left = '0';
//     debuggingPanel.style.bottom = '0';
//     debuggingPanel.style.width = '400px';
//     debuggingPanel.style.height = '150px';
//     debuggingPanel.style.background = 'white';
//     debuggingPanel.style.color = 'black';
//     debuggingPanel.style.border = '2px solid red';

//     debuggingPanel.onclick = () => {
//       setUniversalState({
//         message: 'USER PREVIEW: updated state',
//         randomNumber: Math.random(),
//       });
//     };
//     debuggingPanel.innerHTML = `
//       <pre>
//       <code>${JSON.stringify(universalState, null, 2)}</code>
//       </pre>
//     `;

//     const sbRoot = document.getElementById('storybook-root');
//     sbRoot?.appendChild(debuggingPanel);

//     return StoryFn();
//   },
// ];
