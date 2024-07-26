import { useState } from 'react';

/**
 * A simple custom hook.
 * @returns A stateful value and a function to update it.
 */
const useReactHook = () => {
  const [value, setValue] = useState(0);
  return [value, setValue] as const;
};

export default useReactHook;
