/* eslint-disable react/destructuring-assignment */
import React from 'react';

interface IAProps {
  aProperty: any;
}

interface IBProps {
  bProperty: any;
}

/** A component */
const A = (props: IAProps): React.JSX.Element => {
  return <>Hi {props.aProperty}</>;
};

/** B component */
const B = (props: IBProps): React.JSX.Element => {
  return <>Hi {props.bProperty}</>;
};

export { A, B };
export const component = A;
