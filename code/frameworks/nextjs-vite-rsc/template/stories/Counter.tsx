'use client';

import React, { useState } from 'react';

import styles from './Counter.module.css';

export function Counter({
  label,
  onChange,
}: {
  label: string;
  onChange?: (count: number) => void;
}) {
  const [count, setCount] = useState(0);

  return (
    <button
      type="button"
      className={styles.counter}
      onClick={() => {
        setCount(count + 1);
        onChange?.(count + 1);
      }}
    >
      {label}: {count}
    </button>
  );
}
