import { redactSecrets } from './redact.ts';

type LiveEvent =
  | { type: 'text'; message: string }
  | { type: 'toolCall'; name: string; formattedArgs: string };

// The job log is public and Actions masks only the exact secret value, so an encoded key in agent
// text or in a tool argument is redacted before the line is printed.
export const liveLine = (event: LiveEvent): string =>
  event.type === 'text'
    ? redactSecrets(event.message.trim())
    : `▶ ${event.name}(${redactSecrets(event.formattedArgs).replace(/\s+/g, ' ').slice(0, 300)})`;
