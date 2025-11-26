import React from 'react';

interface InputProps {
  /** The input content value */
  value?: string | number;
}

interface RadioProps extends InputProps {
  defaultChecked?: boolean;
  checked?: boolean;
}

const Radio: React.FC<RadioProps> = (props: RadioProps) => <>{JSON.stringify(props)}</>;

export const component = Radio;
