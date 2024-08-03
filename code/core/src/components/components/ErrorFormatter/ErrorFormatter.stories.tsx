import React from 'react';
import type { StoryObj, Meta } from '@storybook/react';
import { dedent } from 'ts-dedent';

import { ErrorFormatter } from './ErrorFormatter';

const meta: Meta<typeof ErrorFormatter> = {
  component: ErrorFormatter,
  decorators: [
    (Story) => (
      <pre>
        <Story />
      </pre>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof meta>;

const chromeError = new Error('Rendering Problem');
chromeError.stack = `Error: Rendering problem
  at render (http://localhost:6006/blocks/src/examples/Button.stories.tsx?t=1677124831161:147:11)
  at undecoratedStoryFn (http://localhost:6006/sb-preview/runtime.js:8255:38)
  at http://localhost:6006/sb-preview/runtime.js:7286:21
  at http://localhost:6006/sb-preview/runtime.js:8225:12
  at jsxDecorator (http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_react_preview.js?v=0fc15c2d:1892:17)
  at http://localhost:6006/sb-preview/runtime.js:7286:21
  at http://localhost:6006/sb-preview/runtime.js:8200:23
  at http://localhost:6006/sb-preview/runtime.js:8225:12
  at wrapper (http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_addon-links_preview.js?v=0fc15c2d:66:12)
  at http://localhost:6006/sb-preview/runtime.js:11942:12`;
export const Chrome: Story = {
  args: {
    error: chromeError,
  },
};

const safariError = new Error('Rendering Problem');
safariError.stack = dedent`render@http://localhost:6006/blocks/src/examples/Button.stories.tsx?t=1677211545729:147:26
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  jsxDecorator@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_react_preview.js?v=0fc15c2d:1469:22
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  @http://localhost:6006/sb-preview/runtime.js:7:17017
  renderWithHooks@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:11346:35
  mountIndeterminateComponent@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:13419:36
  callCallback2@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:1079:27
  dispatchEvent@[native code]
  invokeGuardedCallbackDev@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:1104:37
  invokeGuardedCallback@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:1135:44
  beginWork$1@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:17143:36
  performUnitOfWork@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16467:31
  workLoopSync@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16452:47
  performSyncWorkOnRoot@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16189:29
  scheduleUpdateOnFiber@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:15844:36
  updateContainer@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18002:23
  @http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18292:30
  unbatchedUpdates@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16296:22
  legacyRenderSubtreeIntoContainer@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18291:29
  @http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-VSGIUGYI.js?v=0fc15c2d:34:148
  Promise@[native code]
  @http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-VSGIUGYI.js?v=0fc15c2d:33:21
  asyncFunctionResume@[native code]
  @[native code]
  promiseReactionJobWithoutPromise@[native code]
  promiseReactionJob@[native code]`;
export const Safari: Story = {
  args: {
    error: safariError,
  },
};

const firefoxError = new Error('Rendering Problem');
firefoxError.stack = dedent`render@http://localhost:6006/blocks/src/examples/Button.stories.tsx?t=1677211545729:147:17
  undecoratedStoryFn@http://localhost:6006/sb-preview/runtime.js:34:2794
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  jsxDecorator@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_react_preview.js?v=0fc15c2d:1469:15
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  decorateStory/<@http://localhost:6006/sb-preview/runtime.js:34:1463
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  wrapper@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_addon-links_preview.js?v=0fc15c2d:43:225
  makeDecorator/decorator/<@http://localhost:6006/sb-preview/runtime.js:93:3440
  makeDecorator/<@http://localhost:6006/sb-preview/runtime.js:93:3553
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  decorateStory/<@http://localhost:6006/sb-preview/runtime.js:34:1463
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  withGrid@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_addon-essentials_backgrounds_preview.js?v=0fc15c2d:116:40
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  decorateStory/<@http://localhost:6006/sb-preview/runtime.js:34:1463
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  withBackground@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_addon-essentials_backgrounds_preview.js?v=0fc15c2d:91:46
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  decorateStory/<@http://localhost:6006/sb-preview/runtime.js:34:1463
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  withMeasure@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_addon-essentials_measure_preview.js?v=0fc15c2d:201:25
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  decorateStory/<@http://localhost:6006/sb-preview/runtime.js:34:1463
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  withOutline@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/@storybook_addon-essentials_outline_preview.js?v=0fc15c2d:443:43
  hookify/<@http://localhost:6006/sb-preview/runtime.js:7:17017
  decorateStory/<@http://localhost:6006/sb-preview/runtime.js:34:1463
  defaultDecorateStory/bindWithContext/<@http://localhost:6006/sb-preview/runtime.js:34:1915
  renderWithHooks@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:11346:35
  mountIndeterminateComponent@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:13419:21
  beginWork@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:14153:22
  callCallback2@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:1079:22
  invokeGuardedCallbackDev@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:1104:24
  invokeGuardedCallback@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:1135:39
  beginWork$1@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:17143:36
  performUnitOfWork@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16467:20
  workLoopSync@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16452:30
  performSyncWorkOnRoot@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16189:17
  scheduleUpdateOnFiber@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:15844:36
  updateContainer@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18002:23
  node_modules/react-dom/cjs/react-dom.development.js/legacyRenderSubtreeIntoContainer/<@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18292:30
  unbatchedUpdates@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:16296:20
  legacyRenderSubtreeIntoContainer@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18291:29
  render@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-DEJXHLHT.js?v=0fc15c2d:18354:18
  renderElement/<@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-VSGIUGYI.js?v=0fc15c2d:34:142
  renderElement@http://localhost:6006/node_modules/.cache/.vite-storybook/deps/chunk-VSGIUGYI.js?v=0fc15c2d:33:10`;
export const Firefox: Story = {
  args: {
    error: firefoxError,
  },
};
