const OUTPUT_TRUNCATED_MARKER = '… output truncated …';
const DEFAULT_MAX_LINES = 12;
const DEFAULT_MAX_CHARS = 700;

export function trimNonChatOutput(
  text: string,
  {
    maxLines = DEFAULT_MAX_LINES,
    maxChars = DEFAULT_MAX_CHARS,
  }: {
    maxLines?: number;
    maxChars?: number;
  } = {}
) {
  const normalized = text.trim();
  if (!normalized) {
    return normalized;
  }

  const lineTrimmed = trimByLines(normalized, maxLines);
  if (lineTrimmed.length <= maxChars) {
    return lineTrimmed;
  }

  return trimByChars(lineTrimmed, maxChars);
}

function trimByLines(text: string, maxLines: number) {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return text;
  }

  const headCount = Math.max(1, Math.floor(maxLines / 2));
  const tailCount = Math.max(1, maxLines - headCount);
  const hiddenCount = Math.max(0, lines.length - headCount - tailCount);

  return [
    ...lines.slice(0, headCount),
    `… ${hiddenCount} more lines …`,
    ...lines.slice(-tailCount),
  ].join('\n');
}

function trimByChars(text: string, maxChars: number) {
  const separatorLength = OUTPUT_TRUNCATED_MARKER.length + 2;
  const availableChars = Math.max(0, maxChars - separatorLength);
  const headLength = Math.max(1, Math.floor(availableChars / 2));
  const tailLength = Math.max(1, availableChars - headLength);

  return `${text.slice(0, headLength)}\n${OUTPUT_TRUNCATED_MARKER}\n${text.slice(-tailLength)}`;
}
