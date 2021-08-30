export type SomeRequired<T, RequiredK extends keyof T> = Pick<T, RequiredK> &
  Partial<Omit<T, RequiredK>>;

export const asyncMap = async <T, U>(
  arr: T[],
  func: (item: T, index: number, array: T[]) => Promise<U>
): Promise<U[]> => {
  const result = [];
  for (const [i, item] of arr.entries()) result.push(await func(item, i, arr));
  return result;
};

export const withDefaults = <T>(defaults: T, opts: Partial<T>): T =>
  Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      opts[key as keyof T] ?? defaultValue,
    ])
  ) as T;
