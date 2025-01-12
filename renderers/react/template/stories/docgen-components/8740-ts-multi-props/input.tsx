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

Paragraph.defaultProps = { size: 'md' };

export const component = Header;
