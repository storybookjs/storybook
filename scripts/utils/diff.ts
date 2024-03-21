import { diff } from 'diff-match-patch-es';

function matchTextScore(text: string, pattern: string) {
  const result = diff(text, pattern);

  if (!result.length) {
    return 0;
  }

  return result.reduce((pre, cur) => {
    const [matchIndex, matchText] = cur;

    if (matchIndex === 0) {
      return pre + matchText.length;
    }

    return pre;
  }, 0);
}

export function findMostMatchText(list: string[], pattern: string) {
  let maxScore = 0;
  let result = '';

  for (const text of list) {
    const score = matchTextScore(text, pattern);

    if (score > maxScore) {
      maxScore = score;
      result = text;
    }
  }

  return result !== '' ? result : null;
}
