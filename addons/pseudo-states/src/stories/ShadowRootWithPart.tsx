import React from 'react';

import './ShadowRootWithPart.css';

export const ShadowRoot = ({ label = 'Hello from shadow DOM' }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!ref.current?.attachShadow) {
      return;
    }

    const shadowRoot = ref.current.attachShadow({ mode: 'open' });
    shadowRoot.innerHTML = `
      <button part="foo">${label}</button>
    `;
  }, [label]);

  return <div ref={ref} />;
};
