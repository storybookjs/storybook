import { S_BAR } from '@clack/prompts';
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

/** Detects URLs in text and prevents them from being broken across lines */
export function protectUrls(
  text: string,
  options?: { maxUrlLength?: number; enableHyperlinks?: boolean }
): string {
  // Use a sensible default based on terminal width if not provided
  const maxUrlLength = options?.maxUrlLength ?? Math.floor(getTerminalWidth() * 0.8);
  const enableHyperlinks = options?.enableHyperlinks ?? true;

  return text.replace(URL_REGEX, (url) => {
    if (maxUrlLength && url.length > maxUrlLength) {
      // Create a truncated version
      const truncatedText = url.substring(0, maxUrlLength - 3) + '...';

      if (enableHyperlinks) {
        // Create a truncated hyperlink that still opens the full URL
        return `\u001b]8;;${url}\u0007${yellow(truncatedText)}\u001b]8;;\u0007`;
      } else {
        // Just apply yellow coloring without hyperlink functionality
        return yellow(truncatedText);
      }
    }

    if (enableHyperlinks) {
      // Apply yellow coloring with hyperlink functionality
      return `\u001b]8;;${url}\u0007${yellow(url)}\u001b]8;;\u0007`;
    } else {
      // Just apply yellow coloring without hyperlink functionality
      return yellow(url);
    }
  });
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

export function wrapTextForClack(text: string, width?: number): string {
  const terminalWidth = width || getTerminalWidth();
  // Reserve space for Clack's visual formatting (prefix, borders, etc.)
  // Clack typically uses about 4-8 characters for its formatting
  const contentWidth = Math.max(terminalWidth - 8, 40);

  return wrapAnsi(text, contentWidth, {
    hard: true,
    trim: false,
    wordWrap: true,
  });
}

// Export additional utilities that might be useful
export { getTerminalWidth };

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
  const firstLineWidth = Math.max(terminalWidth - reservedSpaceFirstLine, 30);

  // For continuation lines, we only need to account for the indentation
  // Format: "│    continuation text..."
  const indentSpaces = 3 + 1; // Total chars before hint text starts: "│  " + "◼ "
  const continuationLineWidth = Math.max(terminalWidth - indentSpaces, 30);

  // First, try wrapping with the continuation line width for optimal wrapping
  // Apply URL protection to prevent URLs from being broken across lines
  const protectedText = protectUrls(text);
  const initialWrap = wrapAnsi(protectedText, continuationLineWidth, {
    hard: true,
    trim: false,
    wordWrap: true,
  });

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
      const protectedRemainder = protectUrls(remainingPart.trim());
      const wrappedRemainder = wrapAnsi(protectedRemainder, continuationLineWidth, {
        hard: true,
        trim: false,
        wordWrap: true,
      });
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
