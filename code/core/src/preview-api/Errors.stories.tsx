import React from 'react';

import AnsiToHtml from 'ansi-to-html';
import { dedent } from 'ts-dedent';

import type { DecoratorFunction } from '../csf/index.ts';
import { createBlock } from './modules/preview-web/WebView.ts';

const ansiConverter = new AnsiToHtml({
  escapeXML: true,
});

const StyleDecorator: DecoratorFunction = (Story) => (
  <>
    <style>{`
          * {
            background-color: green;
            color: green;
          }
        `}</style>
    <Story />
  </>
);

const Component = ({ mode, header, detail }: any) => {
  const element = createBlock(mode);
  const errorMessage = element.querySelector('#error-message');
  const errorStack = element.querySelector('#error-stack');

  if (header) {
    errorMessage!.innerHTML = ansiConverter.toHtml(header);
  }

  if (detail) {
    errorStack!.innerHTML = ansiConverter.toHtml(detail);
  }

  // remove the ids, otherwise chromatic will assume the story failed to render
  errorMessage?.removeAttribute('id');
  errorStack?.removeAttribute('id');

  return <div dangerouslySetInnerHTML={{ __html: element.outerHTML }} />;
};

export default {
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
  globals: { sb_theme: 'light' },
  title: 'Errors',
  args: {
    mode: 'ERROR',
  },
};

export const MyError = {
  args: {
    header: `FAIL is not defined`,
    detail: dedent`
      ReferenceError: FAIL is not defined
        at Constraint.execute (the-best-file.js:525:2)
        at Constraint.recalculate (the-best-file.js:424:21)
        at Planner.addPropagate (the-best-file.js:701:6)
        at Constraint.satisfy (the-best-file.js:184:15)
        at Planner.incrementalAdd (the-best-file.js:591:21)
        at Constraint.addConstraint (the-best-file.js:162:10)
        at Constraint.BinaryConstraint (the-best-file.js:346:7)
        at Constraint.EqualityConstraint (the-best-file.js:515:38)
        at chainTest (the-best-file.js:807:6)
        at deltaBlue (the-best-file.js:879:2)`,
  },
};

export const MyErrorWithCustomCSS = {
  ...MyError,
  decorators: [StyleDecorator],
};

export const Missing = {
  args: {
    mode: 'NOPREVIEW',
  },
};

export const MissingWithCustomCSS = {
  ...Missing,
  decorators: [StyleDecorator],
};
