import React from 'react';

const Component = () => (
  <div>
    <style jsx>{`
      .main p {
        color: #ff4785;
      }
    `}</style>
    <main className="main">
      <p>This is styled using Styled JSX</p>
    </main>
  </div>
);

export default {
  component: Component,
};

export const Default = {};
