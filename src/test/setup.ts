import { afterEach } from 'vitest';

if (typeof localStorage?.setItem !== 'function') {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
      clear: () => values.clear(),
    } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear'>,
  });
}

afterEach(() => {
  if (typeof localStorage.clear === 'function') localStorage.clear();
});
