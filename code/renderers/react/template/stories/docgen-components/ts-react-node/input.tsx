import React from 'react';

interface ReactNodeProps {
  children: React.ReactNode;
  icon: React.ReactElement;
  nodes: React.ReactNode[];
}

const ReactNodeComponent = ({ children }: ReactNodeProps) => <div>{children}</div>;

export const component = ReactNodeComponent;
