import React from 'react';

import 'server-only';

export const RSC = async ({ label }: { label: string }) => <>RSC {label}</>;

export const Nested = async ({ children }: any) => <>Nested {children}</>;

export const WithAsyncFunction = async ({ children }: { children: any }) => {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  return <>Wait 1sec {children}</>;
};
