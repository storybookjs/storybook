import { useEffect, useState } from 'react';

export function getRelativeTimeString(date: Date): string {
  const delta = Math.round((date.getTime() - Date.now()) / 1000);
  const cutoffs = [60, 3600, 86400, 86400 * 7, 86400 * 30, 86400 * 365, Infinity];
  const units: Intl.RelativeTimeFormatUnit[] = [
    'second',
    'minute',
    'hour',
    'day',
    'week',
    'month',
    'year',
  ];

  const unitIndex = cutoffs.findIndex((cutoff) => cutoff > Math.abs(delta));
  const divisor = unitIndex ? cutoffs[unitIndex - 1] : 1;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return rtf.format(Math.floor(delta / divisor), units[unitIndex]);
}

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
