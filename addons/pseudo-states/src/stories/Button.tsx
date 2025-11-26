import React from 'react';

import './button.css';

export const Button = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={['button', className].filter(Boolean).join(' ')} />
);
