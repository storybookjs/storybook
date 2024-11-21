import { useEffect, useState } from 'react';

import { getRelativeTimeString } from '../manager';

export const RelativeTime = ({ timestamp, testCount }: { timestamp: Date; testCount: number }) => {
  const [relativeTimeString, setRelativeTimeString] = useState(null);

  useEffect(() => {
    if (timestamp) {
      setRelativeTimeString(getRelativeTimeString(timestamp).replace(/^now$/, 'just now'));

      const interval = setInterval(() => {
        setRelativeTimeString(getRelativeTimeString(timestamp).replace(/^now$/, 'just now'));
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [timestamp]);

  return (
    relativeTimeString &&
    `Ran ${testCount} ${testCount === 1 ? 'test' : 'tests'} ${relativeTimeString}`
  );
};
