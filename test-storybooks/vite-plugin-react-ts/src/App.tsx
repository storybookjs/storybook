import { useState } from 'react';

import { Button } from './Button.tsx';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <main>
      <h1>Vite + React + Storybook plugin</h1>
      <p>The app itself. Storybook is served by the same dev server under /__storybook.</p>
      <Button label={`count is ${count}`} onClick={() => setCount((c) => c + 1)} />
    </main>
  );
}
