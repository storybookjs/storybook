import React from 'react';

export const SimpleSizeTest = () => {
  return (
    <div
      style={{
        background: '#fd5c9355',
        padding: '3rem',
        height: '500px',
        width: '800px',
        // a global decorator is applying a default padding that we want to negate here
        margin: '-4rem -20px',
      }}
    >
      <p data-testid="sb-iframe-text">
        This story does nothing. Its only purpose is to show how its size renders in different
        conditions (inline/iframe/fixed height) when used in a <code>{'<Story />'}</code> block.
      </p>
      <p>
        It has a fixed <code>height</code> of <code>500px</code> and a fixed <code>width</code> of{' '}
        <code>800px</code>
      </p>
    </div>
  );
};
