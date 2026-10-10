import React from 'react';

import { cookies, headers } from 'next/headers';

export async function RequestInfo() {
  const requestHeaders = await headers();
  const cookieStore = await cookies();

  return (
    <dl>
      <dt>Header x-greeting</dt>
      <dd>{requestHeaders.get('x-greeting') ?? 'none'}</dd>
      <dt>Cookie flavor</dt>
      <dd>{cookieStore.get('flavor')?.value ?? 'none'}</dd>
    </dl>
  );
}
