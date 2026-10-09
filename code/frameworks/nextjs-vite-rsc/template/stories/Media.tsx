import React from 'react';

import { Rubik_Puddles } from 'next/font/google';
import Image from 'next/image';

import accessibility from '../../assets/accessibility.svg';

const rubik = Rubik_Puddles({ subsets: ['latin'], weight: '400' });

export function Media() {
  return (
    <div>
      <h2 className={rubik.className}>A font of next/font</h2>
      <Image src="/next.svg" alt="Next.js logo" width={180} height={38} priority />
      <Image src={accessibility} alt="Accessibility" width={96} height={96} />
    </div>
  );
}
