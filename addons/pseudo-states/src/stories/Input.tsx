import React from 'react';

import './input.css';

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input aria-label="Sample input" {...props} className="input" />
);
