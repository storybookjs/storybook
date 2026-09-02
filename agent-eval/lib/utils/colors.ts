import { createColors } from 'picocolors';

// Not the picocolors default detection: that turns styling on under CI, and
// these strings land in archived eval logs and result artifacts, which must
// stay plain text. Style only a real terminal, honoring NO_COLOR
// (https://no-color.org).
const pc = createColors(process.stdout.isTTY === true && process.env.NO_COLOR === undefined);

export const { bold, dim, red, green, yellow, cyan } = pc;
