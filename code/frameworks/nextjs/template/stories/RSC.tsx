import React from 'react';

import 'server-only';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const RSC = async ({ label }: { label: string }) => <>RSC {label}</>;

export const Nested = async ({ children }: any) => <>Nested {children}</>;

export const RSCWithAwait = async ({ label }: { label: string }) => {
  await sleep(50);
  return <>RSC with await {label}</>;
};

export const RSCWithMultipleAwaits = async ({ label }: { label: string }) => {
  const first = await sleep(20).then(() => 'first');
  const second = await sleep(20).then(() => 'second');
  return (
    <>
      RSC with {first} and {second} await {label}
    </>
  );
};

// A sync (server) component rendering an async child. The async child is not visible from the
// outside, so it can only be handled where the JSX element is created.
export const SyncParentOfAsyncChild = ({ label }: { label: string }) => (
  <div>
    Sync parent <RSCWithAwait label={label} />
  </div>
);
