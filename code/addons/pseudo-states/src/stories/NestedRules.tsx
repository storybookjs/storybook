import React from 'react';

import './nested.css';

export const Button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className="nested-focus-visible" {...props} />
);
