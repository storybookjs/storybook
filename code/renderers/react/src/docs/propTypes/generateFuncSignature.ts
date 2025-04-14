import type { ExtractedJsDocParam, ExtractedJsDocReturns } from 'storybook/internal/docs-tools';

export function generateFuncSignature(
  params: ExtractedJsDocParam[],
  returns: ExtractedJsDocReturns
): string {
  const hasParams = params != null;
  const hasReturns = returns != null;

  if (!hasParams && !hasReturns) {
    return '';
  }

  const funcParts = [];

  if (hasParams) {
    const funcParams = params.map((x: ExtractedJsDocParam) => {
      const prettyName = x.getPrettyName();
      const typeName = x.getTypeName();

      if (typeName != null) {
        return `${prettyName}: ${typeName}`;
      }

      return prettyName;
    });

    funcParts.push(`(${funcParams.join(', ')})`);
  } else {
    funcParts.push('()');
  }

  if (hasReturns) {
    funcParts.push(`=> ${returns.getTypeName()}`);
  }

  return funcParts.join(' ');
}

export function generateShortFuncSignature(
  params: ExtractedJsDocParam[],
  returns: ExtractedJsDocReturns
): string {
  const hasParams = params != null;
  const hasReturns = returns != null;

  if (!hasParams && !hasReturns) {
    return '';
  }

  const funcParts = [];

  if (hasParams) {
    funcParts.push('( ... )');
  } else {
    funcParts.push('()');
  }

  if (hasReturns) {
    funcParts.push(`=> ${returns.getTypeName()}`);
  }

  return funcParts.join(' ');
}

export function toMultilineSignature(signature: string): string {
  return signature.replace(/,/g, ',\r\n');
}
