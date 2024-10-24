export default <T>(a: T[], b: T[]): T[] => {
  // no point in intersecting if one of the input is ill-defined
  if (!a || !b) {
    return [];
  }

  return a.reduce((acc: T[], aValue) => {
    if (b.includes(aValue)) {
      acc.push(aValue);
    }

    return acc;
  }, []);
};
