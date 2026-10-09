'use client';

import React from 'react';

import { usePathname } from 'next/navigation';

export function CurrentPath() {
  return <p>Current path: {usePathname()}</p>;
}
