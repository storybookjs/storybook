interface AlertProps {
  message: string;
  severity?: string;
}
export function Alert({ message: _message, severity: _severity = 'info' }: AlertProps) {
  return null;
}
