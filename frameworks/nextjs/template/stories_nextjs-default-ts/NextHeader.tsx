import React from 'react';

import { cookies, headers } from 'next/headers';

export default async function Component() {
  async function handleClick() {
    'use server';
    (await cookies()).set('user-id', 'encrypted-id');
  }

  return (
    <>
      <h3>Cookies:</h3>
      {(await cookies()).getAll().map(({ name, value }) => {
        return (
          <p key={name} style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            <strong>Name:</strong> <span>{name}</span>
            <strong>Value:</strong> <span>{value}</span>
          </p>
        );
      })}

      <h3>Headers:</h3>
      {Array.from((await headers()).entries()).map(([name, value]: [string, string]) => {
        return (
          <p key={name} style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
            <strong>Name:</strong> <span>{name}</span>
            <strong>Value:</strong> <span>{value}</span>
          </p>
        );
      })}

      <form action={handleClick}>
        <button>add user-id cookie</button>
      </form>
    </>
  );
}
