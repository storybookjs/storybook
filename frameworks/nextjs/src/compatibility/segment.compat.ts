// Compatibility for Next 13
// from https://github.com/vercel/next.js/blob/606f9ff7903b58da51aa043bfe71cd7b6ea306fd/packages/next/src/shared/lib/segment.ts#L4
export function isGroupSegment(segment: string) {
  return segment[0] === '(' && segment.endsWith(')');
}

export const PAGE_SEGMENT_KEY = '__PAGE__';
export const DEFAULT_SEGMENT_KEY = '__DEFAULT__';
