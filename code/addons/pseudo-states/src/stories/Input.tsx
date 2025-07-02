import React from 'react';

import './input.css';

export const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...props} className="input" />
);
