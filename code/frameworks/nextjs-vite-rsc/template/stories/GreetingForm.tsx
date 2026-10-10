'use client';

import React, { useActionState } from 'react';

import { greet } from './actions';

export function GreetingForm() {
  const [greeting, action, pending] = useActionState(greet, '');

  return (
    <form action={action}>
      <label>
        Name <input name="name" defaultValue="Storybook" />
      </label>
      <button type="submit" disabled={pending}>
        Greet
      </button>
      <output>{greeting}</output>
    </form>
  );
}
