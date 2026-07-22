import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Card } from '@acme/ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <Card title="Welcome">The app consumes components from the @acme/ui package.</Card>
    </main>
  </StrictMode>
);
