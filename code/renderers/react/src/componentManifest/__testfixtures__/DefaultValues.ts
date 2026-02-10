interface AlertProps {
  message: string;
  severity?: string;
}
export function Alert({ message, severity = 'info' }: AlertProps) {
  return null;
}
