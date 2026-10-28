export function stripCommentsAndStrings(code: string): string {
  let result = code.replace(/(['"`])(?:\\.|(?!\1)[\s\S])*?\1/g, '""');
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');
  result = result
    .split('\n')
    .map((line) => line.split('//')[0])
    .join('\n');
  return result;
}
