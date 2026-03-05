import type { FC } from 'react';

interface AlertProps {
  message: string;
  severity?: 'info' | 'warning' | 'error';
}

// Internal name is "Alert" but consumers see "NotificationBanner"
const Alert: FC<AlertProps> = (props) => null as any;

export { Alert as NotificationBanner };
