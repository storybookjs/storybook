export function toStartCaseStr(str: string) {
  return str
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\./g, ' ')
    .replace(/([^\n])([A-Z])([a-z])/g, (str2, $1, $2, $3) => `${$1} ${$2}${$3}`)
    .replace(/([a-z])([A-Z])/g, (str2, $1, $2) => `${$1} ${$2}`)
    .replace(/([a-z])([0-9])/gi, (str2, $1, $2) => `${$1} ${$2}`)
    .replace(/([0-9])([a-z])/gi, (str2, $1, $2) => `${$1} ${$2}`)
    .replace(/(\s|^)(\w)/g, (str2, $1, $2) => `${$1}${$2.toUpperCase()}`)
    .replace(/ +/g, ' ')
    .trim();
}
