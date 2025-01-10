import React from 'react';

import { Rubik_Puddles } from 'next/font/google';
import localFont from 'next/font/local';

const rubik = Rubik_Puddles({
  subsets: ['latin'],
  variable: '--font-latin-rubik',
  weight: '400',
});

export const localRubikStorm = localFont({
  src: '/fonts/RubikStorm-Regular.ttf',
  variable: '--font-rubik-storm',
});

export default function Font({ variant }: { variant: 'className' | 'style' | 'variable' }) {
  switch (variant) {
    case 'className':
      return (
        <div>
          <h1 className={rubik.className}>Google Rubik Puddles</h1>
          <h1 className={localRubikStorm.className}>Google Local Rubik Storm</h1>
        </div>
      );
    case 'style':
      return (
        <div>
          <h1 style={rubik.style}>Google Rubik Puddles</h1>
          <h1 style={localRubikStorm.style}>Google Local Rubik Storm</h1>
        </div>
      );
    case 'variable':
      return (
        <div>
          <div className={rubik.variable}>
            <h1
              style={{
                fontFamily: 'var(--font-latin-rubik)',
                fontStyle: rubik.style.fontStyle,
                fontWeight: rubik.style.fontWeight,
              }}
            >
              Google Rubik Puddles
            </h1>
          </div>
          <div className={localRubikStorm.variable}>
            <h1
              style={{
                fontFamily: 'var(--font-rubik-storm)',
                fontStyle: localRubikStorm.style.fontStyle,
                fontWeight: localRubikStorm.style.fontWeight,
              }}
            >
              Google Local Rubik Storm
            </h1>
          </div>
        </div>
      );
    default:
      return null;
  }
}
