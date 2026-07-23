let counter = 0;
/** Stable-ish unique id for list items created at runtime. */
export const makeId = (prefix: string): string =>
  `${prefix}_${counter++}_${Date.now()}`;
