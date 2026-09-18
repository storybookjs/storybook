import React from 'react';

import './cssatrules.css';

export const Button = ({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...props} className={['button', className].filter(Boolean).join(' ')} />
);
