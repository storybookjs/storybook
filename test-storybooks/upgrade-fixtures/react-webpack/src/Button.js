import React from 'react';

export function Button({ label }) {
  return React.createElement('button', { type: 'button' }, label);
}
