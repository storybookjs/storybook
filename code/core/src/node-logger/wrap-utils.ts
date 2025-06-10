import { S_BAR } from '@clack/prompts';
// eslint-disable-next-line depend/ban-dependencies
import { execaSync } from 'execa';
import { cyan, dim, reset, yellow } from 'picocolors';
import wrapAnsi from 'wrap-ansi';

// Text wrapping utility for Clack output
function getTerminalWidth(): number {
  // Default terminal width, fallback for when we can't determine it
  const defaultWidth = 80;

  try {
    // Use process.stdout.columns if available, otherwise fallback
    return process.stdout.columns || defaultWidth;
  } catch {
    return defaultWidth;
  }
}

// ANSI regex pattern to match ANSI escape codes and OSC 8 hyperlink sequences
const ANSI_REGEX = /\u001b\[[0-9;]*m|\u001b\]8;;[^\u0007]*\u0007|\u001b\]8;;\u0007/g;

// URL regex pattern to match URLs
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

function getVisibleLength(str: string): number {
  return stripAnsi(str).length;
}

function getEnvFromTerminal(key: string): string {
  return execaSync('echo', [`$${key}`], { shell: true }).stdout.trim();
}

/**
 * Detects if the current terminal supports OSC 8 hyperlinks Based on terminal identification and
 * known capabilities
 */
function supportsHyperlinks(): boolean {
  try {
    // Check terminal program
    const termProgram = getEnvFromTerminal('TERM_PROGRAM');
    const termProgramVersion = getEnvFromTerminal('TERM_PROGRAM_VERSION');

    switch (termProgram) {
      case 'iTerm.app':
        // iTerm2 supports hyperlinks in version 3.1.0+
        if (termProgramVersion.trim()) {
          const version = termProgramVersion.trim().split('.').map(Number);
          return version[0] > 3 || (version[0] === 3 && version[1] >= 1);
        }
        return true; // Assume recent version

      case 'Apple_Terminal':
        // macOS Terminal.app doesn't support hyperlinks
        return false;

      default:
        // Most other modern terminals support hyperlinks
        return true;
    }
  } catch (error) {
    console.error(error);
    // If we can't execute shell commands, fall back to conservative default
    return false;
  }
}

/** Detects URLs in text and prevents them from being broken across lines */
export function protectUrls(
  text: string,
  options?: { maxUrlLength?: number; maxLineWidth?: number }
): string {
  // Use a sensible default based on terminal width if not provided
  const defaultMaxUrlLength = Math.floor(getTerminalWidth() * 0.8);
  const maxLineWidth = options?.maxLineWidth ?? getTerminalWidth();

  // Determine if we should use hyperlinks
  const useHyperlinks = supportsHyperlinks();

  return text.replace(URL_REGEX, (url: string, offset: number) => {
    if (!useHyperlinks) {
      return url;
    }

    // Calculate how much space is available for this URL on its current line
    const textBeforeUrl = text.substring(0, offset);
    const lastNewlineIndex = textBeforeUrl.lastIndexOf('\n');
    const currentLinePrefix =
      lastNewlineIndex === -1 ? textBeforeUrl : textBeforeUrl.substring(lastNewlineIndex + 1);

    // Calculate available space on this line for the URL
    const prefixLength = getVisibleLength(currentLinePrefix);
    const availableSpace = Math.max(maxLineWidth - prefixLength, 20); // minimum 20 chars for URL

    // Use the smaller of: configured maxUrlLength, default maxUrlLength, or available space
    const effectiveMaxLength = Math.min(
      options?.maxUrlLength ?? defaultMaxUrlLength,
      defaultMaxUrlLength,
      availableSpace
    );

    if (url.length > effectiveMaxLength) {
      // Create a truncated version
      const truncatedText = url.substring(0, effectiveMaxLength - 3) + '...';

      // Create a truncated hyperlink that still opens the full URL
      return `\u001b]8;;${url}\u0007${truncatedText}\u001b]8;;\u0007`;
    }

    // Apply yellow coloring with hyperlink functionality
    return `\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007`;
  });
}

/**
 * Creates a hyperlink with custom title text if supported, otherwise falls back to "title: url"
 * format
 */
export function createHyperlink(title: string, url: string): string {
  if (supportsHyperlinks()) {
    // Create hyperlink using OSC 8 escape sequence: title as display text, url as target
    return `\u001b]8;;${url}\u0007${title}\u001b]8;;\u0007`;
  }

  // Fallback for terminals that don't support hyperlinks
  return `${title}: ${url}`;
}

/** Enhanced word splitting that treats URLs as single units */
function splitTextPreservingUrls(text: string): string[] {
  const parts: string[] = [];
  let lastIndex = 0;
  let match;

  // Reset regex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      const beforeUrl = text.slice(lastIndex, match.index);
      parts.push(...beforeUrl.split(' ').filter((part) => part.length > 0));
    }

    // Add the URL as a single unit
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    parts.push(...remaining.split(' ').filter((part) => part.length > 0));
  }

  return parts;
}

const MAX_OPTIMAL_WIDTH = 80;

function getOptimalWidth(width: number): number {
  return Math.min(width, MAX_OPTIMAL_WIDTH);
}

export function wrapTextForClack(text: string, width?: number): string {
  const terminalWidth = width || getTerminalWidth();
  // Reserve space for Clack's visual formatting (prefix, borders, etc.)
  // Clack typically uses about 4-10 characters for its formatting
  const contentWidth = Math.max(terminalWidth - 10, 40);
  const maxOptimalWidth = getOptimalWidth(contentWidth);

  const protectedText = protectUrls(text, { maxLineWidth: maxOptimalWidth });
  return wrapAnsi(protectedText, maxOptimalWidth);
}

// Export additional utilities that might be useful
export { getTerminalWidth, supportsHyperlinks };

/**
 * Specialized wrapper for hint text that adds stroke characters (│) to continuation lines to
 * maintain visual consistency with clack's multiselect prompts
 */
export function wrapTextForClackHint(text: string, width?: number, label?: string): string {
  const terminalWidth = width || getTerminalWidth();

  // Calculate the space taken by the label
  const labelWidth = label ? getVisibleLength(label) : 0;

  // Reserve space for Clack's visual formatting (prefix, borders, etc.)
  // Additional space for the stroke character, padding, checkbox, and label
  // Format: "│  ◼ labelText (hint text..."
  const reservedSpaceFirstLine = 8 + labelWidth; // 8 chars for "│  ◼ " + "(" + some padding
  const firstLineWidth = Math.min(
    MAX_OPTIMAL_WIDTH - reservedSpaceFirstLine,
    Math.max(terminalWidth - reservedSpaceFirstLine, 30)
  );

  // For continuation lines, we only need to account for the indentation
  // Format: "│    continuation text..."
  const indentSpaces = 3 + 1; // Total chars before hint text starts: "│  " + "◼ "
  const continuationLineWidth = getOptimalWidth(Math.max(terminalWidth - indentSpaces, 30));

  // First, try wrapping with the continuation line width for optimal wrapping
  // Apply URL protection to prevent URLs from being broken across lines
  const protectedText = protectUrls(text, { maxLineWidth: continuationLineWidth });
  const initialWrap = wrapAnsi(protectedText, continuationLineWidth);

  const lines = initialWrap.split('\n');

  // Check if the first line exceeds the first line width
  if (lines.length > 0 && getVisibleLength(lines[0]) > firstLineWidth) {
    // Need to manually break the text at the first line boundary
    // Find the best break point for the first line, treating URLs as single units
    const words = splitTextPreservingUrls(text);
    let firstLinePart = '';
    let remainingPart = '';

    for (let i = 0; i < words.length; i++) {
      const testLine = i === 0 ? words[i] : firstLinePart + ' ' + words[i];

      if (getVisibleLength(testLine) <= firstLineWidth) {
        firstLinePart = testLine;
      } else {
        // This word would make the line too long, so break here
        remainingPart = words.slice(i).join(' ');
        break;
      }
    }

    // If we couldn't fit any words, just use the first word
    if (!firstLinePart && words.length > 0) {
      firstLinePart = words[0];
      remainingPart = words.slice(1).join(' ');
    }

    let finalLines = [firstLinePart];

    // Wrap the remaining text with the wider continuation width
    // Apply URL protection to prevent URLs from being broken
    if (remainingPart.trim()) {
      const protectedRemainder = protectUrls(remainingPart.trim(), {
        maxLineWidth: continuationLineWidth,
      });
      const wrappedRemainder = wrapAnsi(protectedRemainder, continuationLineWidth);
      finalLines = finalLines.concat(wrappedRemainder.split('\n'));
    }

    if (finalLines.length <= 1) {
      return finalLines[0] || '';
    }

    // Use reset + cyan to counteract clack's dimming effect on the vertical line
    const indentation = reset(cyan(S_BAR)) + ' '.repeat(indentSpaces);

    // Add proper indentation to all lines except the first one
    return finalLines
      .map((line, index) => {
        if (index === 0) {
          return line;
        }
        // Add stroke character with proper indentation for continuation lines
        return `${indentation}${dim(line)}`;
      })
      .join('\n');
  }

  // First line fits, so use the optimal wrapping
  if (lines.length <= 1) {
    return initialWrap;
  }

  // Use reset + cyan to counteract clack's dimming effect on the vertical line
  const indentation = reset(cyan(S_BAR)) + ' '.repeat(indentSpaces);

  // Add proper indentation to all lines except the first one
  return lines
    .map((line, index) => {
      if (index === 0) {
        return line;
      }
      // Add stroke character with proper indentation for continuation lines
      return `${indentation}${dim(line)}`;
    })
    .join('\n');
}
