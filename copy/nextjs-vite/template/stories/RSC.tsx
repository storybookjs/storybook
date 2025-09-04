import React from 'react';

import 'server-only';

export const RSC = async ({ label }: { label: string }) => <>RSC {label}</>;

export const Nested = async ({ children }: any) => <>Nested {children}</>;
