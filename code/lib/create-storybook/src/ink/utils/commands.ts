export const ALT_SCREEN_ENTER = '\x1b[?1049h';
export const ALT_SCREEN_LEAVE = '\x1b[?1049l';
export const CLEAR_SCREEN = '\x1Bc';

export const clearScreen = () => process.stdout.write(CLEAR_SCREEN);
export const enterAltScreen = () => process.stdout.write(ALT_SCREEN_ENTER);
export const leaveAltScreen = () => process.stdout.write(ALT_SCREEN_LEAVE);
