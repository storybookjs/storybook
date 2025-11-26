import React from 'react';

export interface ElemAProps {
  size?: 'a' | 'b' | 'c' | 'd';
  children: React.ReactNode;
}

export const Header: React.FC<ElemAProps> = ({ size = 'a', children }) => (
  <div className={size}>{children}</div>
);

export interface ElemBProps {
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Paragraph: React.FC<ElemBProps> = ({ size, children }) => (
  <div className={size}>{children}</div>
);

// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- we can't expect error as it isn't an error in 18 (development) but it is in 19 (sandbox)
// @ts-ignore not present on react 19
Paragraph.defaultProps = { size: 'md' };

export const component = Header;
