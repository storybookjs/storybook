import React from 'react';

export const Unstyled: React.FC<
  React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
> = (props) => <div {...props} className="sb-unstyled" />;
