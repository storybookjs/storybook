import * as React from 'react';

import HeadManagerProvider from './head-manager-provider';

export const HeadManagerDecorator = (Story: React.FC): React.ReactNode => {
  return (
    <HeadManagerProvider>
      <Story />
    </HeadManagerProvider>
  );
};
