import React from 'react';

type AlertCode = 'Code Red' | 'Code Yellow' | 'Code Green';

export interface EmpireAlertProps {
  /** A title that brings attention to the alert. */
  title: AlertCode;
  /** A message alerting about Empire activities. */
  message: string;
}

/** This message should show up in the Docs panel if everything works fine. */
export const EmpireAlert: React.FC<EmpireAlertProps> = ({
  title = 'Code Yellow',
  message,
}: EmpireAlertProps) => (
  <div>
    <h1>{title}</h1>
    <p>{message}</p>
  </div>
);
EmpireAlert.displayName = 'SomeOtherDisplayName';

export const component = EmpireAlert;
