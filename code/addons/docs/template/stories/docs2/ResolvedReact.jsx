import React, * as ReactExport from 'react';
import * as ReactDom from 'react-dom';
import * as ReactDomServer from 'react-dom/server';

export const ResolvedReact = () => {
  return (
    <>
      <p>
        <code>react</code>:{' '}
        <code data-testid="component-react">
          {ReactExport.version ?? 'no version export found'}
        </code>
      </p>
      <p>
        <code>react-dom</code>:{' '}
        <code data-testid="component-react-dom">
          {ReactDom.version ?? 'no version export found'}
        </code>
      </p>
      <p>
        <code>react-dom/server</code>:{' '}
        <code data-testid="component-react-dom-server">
          {ReactDomServer.version ?? 'no version export found'}
        </code>
      </p>
    </>
  );
};
