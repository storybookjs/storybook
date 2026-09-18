import { useState } from 'react';

import { Button } from './components/Button.tsx';
import { Card } from './components/Card.tsx';
import { List } from './components/List.tsx';

export function App() {
  const [count, setCount] = useState(0);

  return (
    <main style={{ display: 'grid', fontFamily: 'sans-serif', gap: 16, padding: 24 }}>
      <h1>devtools-spike demo · react-18</h1>
      <Button
        label="Increment"
        count={count}
        disabled={count >= 10}
        onClick={() => setCount(count + 1)}
      />
      <Card>
        <h2>Card title</h2>
        <p>JSX children rendered by the parent.</p>
      </Card>
      <List items={['alpha', 'beta', 'gamma']} itemTemplate={(item) => <strong>{item}</strong>} />
    </main>
  );
}
