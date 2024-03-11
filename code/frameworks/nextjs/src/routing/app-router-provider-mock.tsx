import React from 'react';

// The mock is used for Next.js < 13, where the AppRouterProvider doesn't exist
export const AppRouterProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  return <>{children}</>;
};
