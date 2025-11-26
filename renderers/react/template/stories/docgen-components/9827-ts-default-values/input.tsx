import React from 'react';

export interface HelloProps {
  title: string;
  foo: boolean;
  bar?: string[];
}

const Hello = ({ title }: HelloProps) => {
  return <div className="hello">Hello Component {title}</div>;
};

Hello.defaultProps = {
  title: 'this is the default :)',
};

export const component = Hello;
