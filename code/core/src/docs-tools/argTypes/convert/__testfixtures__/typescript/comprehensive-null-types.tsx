import type { FC } from 'react';
import React from 'react';

interface Props {
  // Mixed unions with null
  nullableString: string | null;
  nullableNumber: number | null;
  nullableBoolean: boolean | null;
  
  // Literal unions with null
  literalWithNull: 'option1' | 'option2' | null;
  
  // Boolean literal unions
  booleanLiterals: true | false | null;
  
  // Complex unions
  complexUnion: string | number | boolean | null | undefined;
  
  // Just literal values
  justNull: null;
  justUndefined: undefined;
  justTrue: true;
  justFalse: false;
}

export const Component: FC<Props> = (props: Props) => <>JSON.stringify(props)</>;