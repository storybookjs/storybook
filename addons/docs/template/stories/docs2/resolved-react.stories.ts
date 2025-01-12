import * as ReactExport from 'react';
import * as ReactDom from 'react-dom';
import * as ReactDomServer from 'react-dom/server';

import { expect, within } from '@storybook/test';

/**
 * This component is used to display the resolved version of React and its related packages. As long
 * as `@storybook/addon-docs` is installed, `react` and `react-dom` should be available to import
 * from and should resolve to the same version.
 *
 * The autodocs here ensures that it also works in the generated documentation.
 *
 * - See the [MDX docs](/docs/addons-docs-docs2-resolvedreact--mdx) for how it resolves in MDX.
 * - See the [Story](/story/addons-docs-docs2-resolvedreact--story) for how it resolves in the actual
 *   story.
 *
 * **Note: There appears to be a bug in the _production_ build of `react-dom`, where it reports
 * version `18.2.0-next-9e3b772b8-20220608` while in fact version `18.2.0` is installed.**
 */
export default {
  title: 'Docs2/ResolvedReact',
  component: globalThis.Components.Html,
  tags: ['autodocs'],
  argTypes: {
    content: { table: { disable: true } },
  },
  args: {
    content: `
      <p>
        <code>react</code>: <code data-testid="react">${
          ReactExport.version ?? 'no version export found'
        }</code>
      </p>
      <p>
        <code>react-dom</code>: <code data-testid="react-dom">${
          ReactDom.version ?? 'no version export found'
        }</code>
      </p>
      <p>
        <code>react-dom/server</code>: <code data-testid="react-dom-server">${
          ReactDomServer.version ?? 'no version export found'
        }</code>
      </p>
  `,
  },
  parameters: {
    docs: {
      name: 'ResolvedReact',
    },
    // the version string changes with every release of React/Next.js/Preact, not worth snapshotting
    chromatic: { disable: true },
  },
};

export const Story = {
  // This test is more or less the same as the E2E test we have for MDX and autodocs entries in addon-docs.spec.ts
  play: async ({ canvasElement, step, parameters }: any) => {
    const canvas = await within(canvasElement);

    const actualReactVersion = (await canvas.findByTestId('react')).textContent;
    const actualReactDomVersion = (await canvas.findByTestId('react-dom')).textContent;
    const actualReactDomServerVersion = (await canvas.findByTestId('react-dom-server')).textContent;

    step('Expect React packages to all resolve to the same version', () => {
      // react-dom has a bug in its production build, reporting version 18.2.0-next-9e3b772b8-20220608 even though version 18.2.0 is installed.
      expect(actualReactDomVersion!.startsWith(actualReactVersion!)).toBeTruthy();

      if (parameters.renderer === 'preact') {
        // the preact/compat alias doesn't have a version export in react-dom/server
        return;
      }
      expect(actualReactDomServerVersion).toBe(actualReactVersion);
    });
  },
};
