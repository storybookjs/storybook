import React from 'react';

import 'server-only';

export const RSC = async ({ label }: { label: string }) => <>RSC {label}</>;

export const Nested = async ({ children }: any) => <>Nested {children}</>;

export async function ServerComponentWithOneAwait() {
  const md1 = await getMockData(1);
  return <p>{md1}</p>;
}

export async function ServerComponentWithManyAwaits() {
  const md1 = await getMockData(1);
  const md2 = await getMockData(2);
  return (
    <p>
      {md1} + {md2}
    </p>
  );
}

export function getMockData(i: number): Promise<string> {
  return new Promise((resolve) => setTimeout(() => resolve(`mock data ${i}`), 1000));
}
