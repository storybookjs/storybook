// @ts-expect-error no types
import * as React from 'next/dist/compiled/react';

import HeadManagerProvider from './head-manager-provider';

export const HeadManagerDecorator = (Story: React.FC): React.ReactNode => {
  return (
    <HeadManagerProvider>
      <Story />
    </HeadManagerProvider>
  );
};
