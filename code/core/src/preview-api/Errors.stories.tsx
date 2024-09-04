import React from 'react';

import AnsiToHtml from 'ansi-to-html';
import { dedent } from 'ts-dedent';

const ansiConverter = new AnsiToHtml({
  escapeXML: true,
});

const Component = ({ id, header, detail }: any) => {
  const element = document.querySelector('.' + id);
  if (!element) {
    throw new Error('Element not found');
  }

  if (header) {
    document.getElementById('error-message')!.innerHTML = ansiConverter.toHtml(header);
  }

  if (detail) {
    document.getElementById('error-stack')!.innerHTML = ansiConverter.toHtml(detail);
  }

  // remove the ids, otherwise chromatic will assume the story failed to render
  const content = element.outerHTML.replace('error-message', '').replace('error-stack', '');

  // remove the content, otherwise chromatic will assume the story failed to render
  document.getElementById('error-message')!.innerHTML = '';
  document.getElementById('error-stack')!.innerHTML = '';

  return (
    <div
      className="sb-show-nopreview sb-show-errordisplay"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
};

export default {
  component: Component,
  parameters: {
    layout: 'fullscreen',
  },
  globals: { sb_theme: 'light' },
  title: 'Errors',
  args: {
    id: 'sb-errordisplay',
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

export const Missing = {
  args: {
    id: 'sb-nopreview',
  },
};
