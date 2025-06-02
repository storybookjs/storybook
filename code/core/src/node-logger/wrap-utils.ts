import { S_BAR } from '@clack/prompts';
import { cyan, dim, reset } from 'picocolors';

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

// ANSI regex pattern to match ANSI escape codes
const ANSI_REGEX = /\u001b\[[0-9;]*m/g;

function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, '');
}

function getVisibleLength(str: string): number {
  return stripAnsi(str).length;
}

// Enhanced ANSI parsing that preserves color state
interface AnsiSegment {
  text: string;
  codes: string[];
}

function parseAnsiText(str: string): AnsiSegment[] {
  const segments: AnsiSegment[] = [];
  let currentCodes: string[] = [];
  let lastIndex = 0;
  let match;

  // Reset the regex index
  ANSI_REGEX.lastIndex = 0;

  while ((match = ANSI_REGEX.exec(str)) !== null) {
    // Add text before this ANSI code
    if (match.index > lastIndex) {
      const text = str.slice(lastIndex, match.index);
      if (text.length > 0) {
        // Split on newlines but preserve the newline structure
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].length > 0 || (i === 0 && lines.length === 1)) {
            segments.push({ text: lines[i], codes: [...currentCodes] });
          }
          // Add newline as separate segment (except for the last line)
          if (i < lines.length - 1) {
            segments.push({ text: '\n', codes: [] });
          }
        }
      }
    }

    // Update current codes
    const ansiCode = match[0];
    if (ansiCode.includes('0m') || ansiCode.includes('39m') || ansiCode.includes('49m')) {
      // Reset code
      currentCodes = [];
    } else {
      // Add/update color code
      currentCodes.push(ansiCode);
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < str.length) {
    const text = str.slice(lastIndex);
    if (text.length > 0) {
      // Split on newlines but preserve the newline structure
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > 0 || (i === 0 && lines.length === 1)) {
          segments.push({ text: lines[i], codes: [...currentCodes] });
        }
        // Add newline as separate segment (except for the last line)
        if (i < lines.length - 1) {
          segments.push({ text: '\n', codes: [] });
        }
      }
    }
  }

  return segments;
}

function reconstructAnsiText(segments: AnsiSegment[]): string {
  return segments
    .map((segment) => {
      if (segment.codes.length > 0) {
        return segment.codes.join('') + segment.text + '\u001b[0m';
      }
      return segment.text;
    })
    .join('');
}

// Characters that should not be left hanging alone at the end of a line
const NO_BREAK_AFTER = /[✔✓✗✘•▪▫◦‣⁃\-–—]\s*$/;

// Check if a text segment ends with a symbol that shouldn't be left hanging
function shouldStayWithNext(text: string): boolean {
  return NO_BREAK_AFTER.test(text.trim());
}

function manualWrapWithAnsi(text: string, width: number): string {
  const visibleLength = getVisibleLength(text);
  if (visibleLength <= width) {
    return text;
  }

  const segments = parseAnsiText(text);
  const lines: string[] = [];
  let currentLineSegments: AnsiSegment[] = [];
  let currentLineLength = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
    const segment = segments[segmentIndex];
    const nextSegment = segments[segmentIndex + 1];

    // Handle explicit newlines
    if (segment.text === '\n') {
      if (currentLineSegments.length > 0) {
        lines.push(reconstructAnsiText(currentLineSegments));
        currentLineSegments = [];
        currentLineLength = 0;
      }
      continue;
    }

    // Skip empty or whitespace-only segments unless they contain meaningful whitespace
    if (!segment.text.trim() && segment.text !== ' ') {
      continue;
    }

    const segmentVisibleLength = getVisibleLength(segment.text);

    // Check if this segment should stay with the next one (e.g., checkmark + path)
    const shouldStayTogether = nextSegment && shouldStayWithNext(segment.text);

    if (shouldStayTogether) {
      // Calculate combined length of this segment and next segment
      const nextSegmentLength = getVisibleLength(nextSegment.text);
      const combinedLength = segmentVisibleLength + nextSegmentLength;

      if (currentLineLength + combinedLength <= width) {
        // Both segments fit on current line
        currentLineSegments.push(segment);
        currentLineLength += segmentVisibleLength;
        continue; // Let the next iteration handle the next segment normally
      } else if (combinedLength <= width) {
        // Both segments fit on a new line
        if (currentLineSegments.length > 0) {
          lines.push(reconstructAnsiText(currentLineSegments));
          currentLineSegments = [];
          currentLineLength = 0;
        }
        currentLineSegments.push(segment);
        currentLineLength += segmentVisibleLength;
        continue; // Let the next iteration handle the next segment normally
      }
      // If combined length is too long, fall through to normal processing
    }

    // Try to fit the entire segment on the current line first
    if (currentLineLength + segmentVisibleLength <= width) {
      // Entire segment fits on current line
      currentLineSegments.push(segment);
      currentLineLength += segmentVisibleLength;
    } else if (segmentVisibleLength <= width) {
      // Segment fits on a new line by itself
      if (currentLineSegments.length > 0) {
        lines.push(reconstructAnsiText(currentLineSegments));
        currentLineSegments = [];
        currentLineLength = 0;
      }
      currentLineSegments.push(segment);
      currentLineLength = segmentVisibleLength;
    } else {
      // Segment is too long, need to break it by words
      if (currentLineSegments.length > 0) {
        lines.push(reconstructAnsiText(currentLineSegments));
        currentLineSegments = [];
        currentLineLength = 0;
      }

      const words = segment.text.split(' ');
      let currentSegmentText = '';

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const isLastWord = i === words.length - 1;
        const testText = currentSegmentText + (currentSegmentText ? ' ' : '') + word;
        const testLength = testText.length;

        if (testLength <= width) {
          // Word fits in current segment
          currentSegmentText = testText;

          if (isLastWord) {
            // This is the last word, add the segment
            currentLineSegments.push({
              text: currentSegmentText,
              codes: segment.codes,
            });
            currentLineLength = testLength;
          }
        } else {
          // Word doesn't fit
          if (currentSegmentText) {
            // Add current segment and start new line
            currentLineSegments.push({
              text: currentSegmentText,
              codes: segment.codes,
            });
            if (currentLineSegments.length > 0) {
              lines.push(reconstructAnsiText(currentLineSegments));
              currentLineSegments = [];
              currentLineLength = 0;
            }
            currentSegmentText = word;
          } else {
            // Single word is too long, break it
            if (word.length > width) {
              let remainingWord = word;
              while (remainingWord.length > 0) {
                const partLength = Math.min(remainingWord.length, width);
                const part = remainingWord.slice(0, partLength);
                lines.push(reconstructAnsiText([{ text: part, codes: segment.codes }]));
                remainingWord = remainingWord.slice(partLength);
              }
              currentSegmentText = '';
            } else {
              currentSegmentText = word;
            }
          }

          if (isLastWord && currentSegmentText) {
            currentLineSegments.push({
              text: currentSegmentText,
              codes: segment.codes,
            });
            currentLineLength = currentSegmentText.length;
          }
        }
      }
    }
  }

  if (currentLineSegments.length > 0) {
    lines.push(reconstructAnsiText(currentLineSegments));
  }

  return lines.join('\n');
}

export function wrapTextForClack(text: string, width?: number): string {
  const terminalWidth = width || getTerminalWidth();
  // Reserve space for Clack's visual formatting (prefix, borders, etc.)
  // Clack typically uses about 4-8 characters for its formatting
  const contentWidth = Math.max(terminalWidth - 8, 40);

  // Import wrap-ansi dynamically to handle text wrapping with ANSI codes
  try {
    const wrapAnsi = require('wrap-ansi');
    return wrapAnsi(text, contentWidth, {
      hard: true,
      trim: false,
      wordWrap: true,
    });
  } catch {
    // Fallback to manual line breaking if wrap-ansi is not available
    return manualWrapWithAnsi(text, contentWidth);
  }
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
  const reservedSpace = 8 + labelWidth; // 8 chars for "│  ◼ " + "(" + some padding
  const contentWidth = Math.max(terminalWidth - reservedSpace, 30);

  let wrappedText: string;

  // Import wrap-ansi dynamically to handle text wrapping with ANSI codes
  try {
    const wrapAnsi = require('wrap-ansi');
    wrappedText = wrapAnsi(text, contentWidth, {
      hard: true,
      trim: false,
      wordWrap: true,
    });
  } catch {
    // Fallback to manual line breaking if wrap-ansi is not available
    wrappedText = manualWrapWithAnsi(text, contentWidth);
  }

  // Split into lines and add stroke character to continuation lines
  const lines = wrappedText.split('\n');

  if (lines.length <= 1) {
    return wrappedText;
  }

  // Calculate indentation to align with the start of the hint text
  // Format: "│  ◼ labelText (hint text..."
  // Indentation: "│  " + "◼ "
  const indentSpaces = 3 + 1; // Total chars before hint text starts
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
