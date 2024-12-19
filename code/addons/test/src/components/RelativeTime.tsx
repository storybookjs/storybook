import { useEffect, useState } from 'react';

export const RelativeTime = ({ timestamp }: { timestamp?: number }) => {
  const [timeAgo, setTimeAgo] = useState(null);

  useEffect(() => {
    if (timestamp) {
      setTimeAgo(Date.now() - timestamp);
      const interval = setInterval(() => setTimeAgo(Date.now() - timestamp), 10000);
      return () => clearInterval(interval);
    }
  }, [timestamp]);

  if (timeAgo === null) {
    return null;
  }

  const seconds = Math.round(timeAgo / 1000);
  if (seconds < 60) {
    return `just now`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return minutes === 1 ? `a minute ago` : `${minutes} minutes ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return hours === 1 ? `an hour ago` : `${hours} hours ago`;
  }

  const days = Math.floor(hours / 24);
  return days === 1 ? `yesterday` : `${days} days ago`;
};
