'use client';

import { useState } from 'react';

/** Client component so the fiber walk finds a real function fiber (server
 * components are materialized via the RSC payload and have no client fiber). */
export function ProbeCard(props: { title: string }) {
  const [count, setCount] = useState(42);
  return (
    <div style={{ border: '1px solid #cbd5e1', padding: 16, borderRadius: 8 }}>
      <h2 style={{ margin: '0 0 8px' }}>{props.title}</h2>
      <p style={{ margin: 0 }}>
        count: {count}{' '}
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          +1
        </button>
      </p>
    </div>
  );
}
