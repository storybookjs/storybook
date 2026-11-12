import { redactSecrets } from './redact.ts';

type LiveEvent =
  | { type: 'text'; message: string }
  | { type: 'toolCall'; name: string; formattedArgs: string };

// Actions runs a log line as a workflow command when it starts with `::` or holds `##[`.
const withoutCommands = (text: string): string =>
  text.replace(/^(\s*)::/gm, '$1: :').replaceAll('##[', '## [');

// The job log is public and Actions masks only the exact secret value, so an encoded key in what
// an agent wrote is redacted before it is printed.
export const forJobLog = (text: string): string => withoutCommands(redactSecrets(text));

export const liveLine = (event: LiveEvent): string =>
  event.type === 'text'
    ? forJobLog(event.message.trim())
    : withoutCommands(
        `▶ ${event.name}(${redactSecrets(event.formattedArgs).replace(/\s+/g, ' ').slice(0, 300)})`
      );
