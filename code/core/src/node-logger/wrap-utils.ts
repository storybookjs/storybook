import { stripVTControlCharacters } from 'node:util';

import wrapAnsi from 'wrap-ansi';

// Text wrapping utility for Clack output
function getTerminalWidth(): number {
  // Default terminal width, fallback for when we can't determine it
  const defaultWidth = 80;

  try {
    // A pty can report a zero or negative width (`script(1)`), and callers divide by it.
    return process.stdout.columns > 0 ? process.stdout.columns : defaultWidth;
  } catch {
    return defaultWidth;
  }
}

// URL regex pattern to match URLs
const URL_REGEX = /(https?:\/\/[^\s\u0000-\u001F\u007F]+)/g;

function getVisibleLength(str: string): number {
  return stripVTControlCharacters(str).length;
}

function getEnvFromTerminal(key: string): string {
  return (process.env[key] || '').trim();
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
  } catch {
    // If we can't access environment variables, fall back to conservative default
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

  return text.replace(URL_REGEX, (match: string, capturedUrl: string, offset: number) => {
    if (!useHyperlinks) {
      return match;
    }

    // Check if this URL is inside an existing OSC 8 hyperlink sequence
    // OSC 8 format: \u001b]8;;target_url\u0007display_text\u001b]8;;\u0007
    // We need to avoid processing URLs that are part of existing hyperlinks

    let searchPos = 0;
    while (true) {
      const hyperlinkStart = text.indexOf('\u001b]8;;', searchPos);

      if (hyperlinkStart === -1) {
        break;
      }

      const hyperlinkEnd = text.indexOf('\u001b]8;;\u0007', hyperlinkStart);
      if (hyperlinkEnd === -1) {
        searchPos = hyperlinkStart + 1;
        continue;
      }

      // Check if our URL falls anywhere within this hyperlink sequence
      if (offset >= hyperlinkStart && offset < hyperlinkEnd + 7) {
        // +7 for '\u001b]8;;\u0007'
        // This URL is within an existing hyperlink sequence, don't modify it
        return match;
      }

      searchPos = hyperlinkEnd + 1;
    }

    // Calculate how much space is available for this URL on its current line
    const textBeforeUrl = text.substring(0, offset);
    const lastNewlineIndex = textBeforeUrl.lastIndexOf('\n');
    const currentLinePrefix =
      lastNewlineIndex === -1 ? textBeforeUrl : textBeforeUrl.substring(lastNewlineIndex + 1);

    // Calculate available space on this line for the URL
    const prefixLength = getVisibleLength(currentLinePrefix);
    const availableSpace = maxLineWidth - prefixLength;
    const minUrlLength = 20; // minimum URL length, don't truncate URLs shorter than this

    // Use the smaller of: configured maxUrlLength, default maxUrlLength, or available space
    // But never go below the minimum URL length
    const configuredMax = options?.maxUrlLength ?? defaultMaxUrlLength;
    let effectiveMaxLength = Math.min(configuredMax, defaultMaxUrlLength, availableSpace);

    // If the URL is short enough (at or below minimum), don't truncate it
    if (capturedUrl.length <= minUrlLength) {
      effectiveMaxLength = capturedUrl.length;
    } else if (effectiveMaxLength < minUrlLength) {
      // If available space would result in very short truncation, don't truncate at all
      effectiveMaxLength = capturedUrl.length;
    }

    if (capturedUrl.length > effectiveMaxLength) {
      // Create a truncated version
      const truncatedText = capturedUrl.substring(0, effectiveMaxLength - 3) + '...';

      // Create a truncated hyperlink that still opens the full URL
      return `\u001b]8;;${capturedUrl}\u0007${truncatedText}\u001b]8;;\u0007`;
    }

    // Apply hyperlink functionality
    return `\u001b]8;;${capturedUrl}\u0007${capturedUrl}\u001b]8;;\u0007`;
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
