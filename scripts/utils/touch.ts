const isWin = process.platform === 'win32';

export default function touch(filePath: string) {
  if (isWin) {
    return `echo. > ${filePath}`;
  }
  return `touch ${filePath}`;
}
