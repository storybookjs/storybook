import React from 'react';

import Link from 'next/link';

import { CurrentPath } from './CurrentPath';

export function Navigation() {
  return (
    <nav>
      <CurrentPath />
      <Link href="/">Home</Link>
    </nav>
  );
}
