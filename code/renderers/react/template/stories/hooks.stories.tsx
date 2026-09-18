import type { FC } from 'react';
import React, { useState } from 'react';

const ButtonWithState: FC = () => {
  const [count, setCount] = useState(0);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      {`count: ${count}`}
    </button>
  );
};

export default {
  component: ButtonWithState,
};

export const Basic = {};
