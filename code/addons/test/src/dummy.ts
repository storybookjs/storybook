// Due to a bug in tsup, this file is necessary because otherwise if for a certain build step a root file isn't given
// tsup will flatten the directory structure and the output will be in the root of the dist output directory
// https://github.com/egoist/tsup/issues/728
export default {};
